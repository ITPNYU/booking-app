import type { SchemaContextType } from "@/components/src/client/routes/components/SchemaProvider";
import { isValidTenant } from "@/components/src/constants/tenants";
import { TableNames } from "@/components/src/policy";
import { coerceTenantSchema } from "@/lib/tenant/coerceTenantSchema";
import {
  canonicalizeTenantSlug,
  isTemplateSchemaId,
  isTenantSlugShape,
} from "@/lib/tenant/tenantSlug";
import { shouldBypassAuth } from "@/lib/utils/testEnvironment";
import { getTestTenantSchema } from "@/lib/utils/testTenantSchema";

// Module-level in-memory cache shared across requests within the same
// Node worker instance until the TTL expires. This avoids a duplicate
// Firestore read when generateMetadata and the Layout component run in
// the same request, and may also serve cached data across requests.
const cache = new Map<string, { data: SchemaContextType | null; ts: number }>();
const TTL_MS = 30_000; // 30 seconds
const MAX_CACHE_SIZE = 20;

/**
 * Fetch tenant schema, shared by layout and generateMetadata.
 */
export async function getCachedTenantSchema(
  tenant: string,
): Promise<SchemaContextType | null> {
  if (isTemplateSchemaId(tenant)) {
    return null;
  }
  const canonical = canonicalizeTenantSlug(tenant);
  if (!isTenantSlugShape(canonical)) {
    return null;
  }
  if (shouldBypassAuth() && isValidTenant(canonical)) {
    const test = getTestTenantSchema(canonical);
    return test
      ? coerceTenantSchema(
          test as unknown as Record<string, unknown>,
          canonical,
        )
      : null;
  }

  const now = Date.now();
  const cached = cache.get(canonical);
  if (cached && now - cached.ts < TTL_MS) {
    return cached.data;
  }

  // Evict stale entries first, then evict the oldest remaining entry if the
  // cache is still at capacity and this is a new tenant key.
  if (cache.size >= MAX_CACHE_SIZE) {
    for (const [key, entry] of cache) {
      if (now - entry.ts >= TTL_MS) cache.delete(key);
    }

    if (cache.size >= MAX_CACHE_SIZE && !cache.has(canonical)) {
      const oldestKey = cache.keys().next().value;
      if (oldestKey !== undefined) {
        cache.delete(oldestKey);
      }
    }
  }

  const { serverGetDocumentById } =
    await import("@/lib/firebase/server/adminDb");
  const data = await serverGetDocumentById<Record<string, unknown>>(
    TableNames.TENANT_SCHEMA,
    canonical,
  );
  const coerced = data !== null ? coerceTenantSchema(data, canonical) : null;
  if (coerced !== null) {
    cache.set(canonical, { data: coerced, ts: now });
  }
  return coerced;
}
