import admin from "@/lib/firebase/server/firebaseAdmin";
import { getNYUToken, NYU_API_BASE } from "@/lib/server/nyuApiAuth";
import { selectIdentityRecord } from "@/lib/utils/identityRecord";

/** Public API access ID — not a secret, safe to hardcode. */
const NYU_API_ACCESS_ID = "20201957";

/**
 * Firestore collection used to cache NYU Identity API responses. The doc id is
 * the uniqueId (netId in practice) the cached record belongs to.
 *
 * Cached because the upstream NYU MuleSoft Identity API has a p50 latency of
 * ~2.7s in production and holds memory on the App Engine instance while it
 * waits, which contributes to the OOM kills we see on the F1 instance. The
 * underlying NYU record (name / dept_code / school / affiliations) is stable
 * over many days, so a multi-day cache is safe.
 */
const CACHE_COLLECTION = "nyu_identity_cache";

/** 7 days. Department / school can change at semester boundaries; netId never. */
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

type CachedRecord = {
  data: Record<string, unknown>;
  cachedAt: admin.firestore.Timestamp;
  /**
   * Pre-computed expiry timestamp. Enables a Firestore TTL policy on this
   * field (Firestore console: TTL policy on `nyu_identity_cache.expiresAt`)
   * so expired docs are purged automatically. The read-time check still
   * uses `cachedAt + CACHE_TTL_MS` as the source of truth.
   */
  expiresAt: admin.firestore.Timestamp;
};

async function readCache(uniqueId: string): Promise<Record<string, unknown> | null> {
  try {
    const snap = await admin
      .firestore()
      .collection(CACHE_COLLECTION)
      .doc(uniqueId)
      .get();
    if (!snap.exists) return null;
    const cached = snap.data() as CachedRecord | undefined;
    if (!cached?.data || !cached.cachedAt) return null;
    const ageMs = Date.now() - cached.cachedAt.toMillis();
    if (ageMs > CACHE_TTL_MS) return null;
    return cached.data;
  } catch (error) {
    console.warn("nyuIdentity cache read failed", { uniqueId, error });
    return null;
  }
}

async function writeCache(
  uniqueId: string,
  data: Record<string, unknown>,
): Promise<void> {
  try {
    const now = Date.now();
    await admin
      .firestore()
      .collection(CACHE_COLLECTION)
      .doc(uniqueId)
      .set({
        data,
        cachedAt: admin.firestore.Timestamp.fromMillis(now),
        expiresAt: admin.firestore.Timestamp.fromMillis(now + CACHE_TTL_MS),
      });
  } catch (error) {
    console.warn("nyuIdentity cache write failed", { uniqueId, error });
  }
}

async function fetchFromNYUAPI(
  uniqueId: string,
): Promise<Record<string, unknown> | null> {
  const token = await getNYUToken();
  if (!token) {
    console.warn("Failed to fetch NYU identity: missing NYU API token", {
      uniqueId,
    });
    return null;
  }

  const url = new URL(
    `${NYU_API_BASE}/identity/unique-id/${encodeURIComponent(uniqueId)}`,
  );
  url.searchParams.append("api_access_id", NYU_API_ACCESS_ID);

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    console.warn("Failed to fetch NYU identity: upstream returned non-OK", {
      uniqueId,
      status: response.status,
    });
    return null;
  }

  const userData = await response.json();
  return selectIdentityRecord(userData);
}

/**
 * In-flight upstream fetches keyed by uniqueId. Coalesces concurrent cache
 * misses for the same user (e.g. /api/nyu/identity + /api/nyu/entitlements
 * firing in parallel on first page load) so they share a single upstream
 * call instead of each spending ~2.7s and ~MB of App Engine memory.
 */
const inFlight = new Map<string, Promise<Record<string, unknown> | null>>();

/**
 * Fetch identity data for a given uniqueId from the NYU Identity API.
 *
 * Wraps the live upstream call with a Firestore-backed 7-day cache. The
 * cache layer is transparent to callers — they still get either the identity
 * record or null on failure, and the upstream call is the source of truth on
 * cache miss. Cache failures (read or write) degrade silently to live fetch.
 */
export async function fetchNYUIdentity(
  uniqueId: string,
): Promise<Record<string, unknown> | null> {
  const cached = await readCache(uniqueId);
  if (cached) return cached;

  const existing = inFlight.get(uniqueId);
  if (existing) return existing;

  const pending = (async () => {
    const fresh = await fetchFromNYUAPI(uniqueId);
    if (fresh) {
      // Fire-and-forget cache write so a slow Firestore write does not
      // re-introduce upstream latency for the caller.
      void writeCache(uniqueId, fresh);
    }
    return fresh;
  })().finally(() => {
    inFlight.delete(uniqueId);
  });

  inFlight.set(uniqueId, pending);
  return pending;
}
