import { getCalendarClient } from "@/lib/googleClient";
import { calendar_v3 } from "googleapis/build/src/apis/calendar";

// ── Google Calendar raw-events cache with request coalescing ──
// Fetching a room calendar over a date range is the expensive part of
// /api/calendarEvents (multiple paginated Google API round-trips). Many
// concurrent page loads request the same (calendarId, range), so we cache the
// raw Google events per (calendarId, timeMin, timeMax) for a short TTL and
// coalesce concurrent misses into a single upstream fetch. Booking data is
// merged separately by the caller from its own (fresher) cache, so a new
// booking's status still updates without waiting on this TTL; only the raw
// calendar event itself is TTL-bound (and `fresh` bypasses it).
const CALENDAR_CACHE_TTL = 60_000; // 60 seconds

type CacheEntry = { data: calendar_v3.Schema$Event[]; timestamp: number };

const cache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<calendar_v3.Schema$Event[]>>();

/** @internal – exposed only for unit tests to reset module-level cache. */
export function _resetCalendarEventsCacheForTesting() {
  cache.clear();
  inflight.clear();
}

const cacheKey = (calendarId: string, timeMin: string, timeMax: string) =>
  `${calendarId}|${timeMin}|${timeMax}`;

async function fetchFromGoogle(
  calendarId: string,
  timeMin: string,
  timeMax: string,
): Promise<calendar_v3.Schema$Event[]> {
  const events: calendar_v3.Schema$Event[] = [];
  const calendar = await getCalendarClient();
  let pageToken: string | undefined;

  do {
    const res = await calendar.events.list({
      calendarId,
      timeMin,
      timeMax,
      singleEvents: true,
      orderBy: "startTime",
      maxResults: 250,
      pageToken,
      fields:
        "nextPageToken,items(id,summary,start(dateTime,date),end(dateTime,date))",
    });
    if (res.data.items) events.push(...res.data.items);
    pageToken = res.data.nextPageToken || undefined;
  } while (pageToken);

  return events;
}

function refresh(
  key: string,
  calendarId: string,
  timeMin: string,
  timeMax: string,
): Promise<calendar_v3.Schema$Event[]> {
  const existing = inflight.get(key);
  if (existing) return existing;
  const promise = fetchFromGoogle(calendarId, timeMin, timeMax)
    .then((data) => {
      cache.set(key, { data, timestamp: Date.now() });
      inflight.delete(key);
      return data;
    })
    .catch((err) => {
      inflight.delete(key);
      throw err;
    });
  inflight.set(key, promise);
  return promise;
}

/**
 * Return the raw Google Calendar events for `calendarId` in [timeMin, timeMax].
 *
 * Serving strategy (so users rarely wait on Google):
 *   - fresh cache hit  → return immediately.
 *   - stale cache hit  → return the stale data immediately AND refresh in the
 *                        background (stale-while-revalidate). No user waits.
 *   - cache miss       → await a single fetch, coalescing concurrent misses.
 *   - options.fresh    → bypass the cache and await a fresh fetch (used after a
 *                        booking is created/changed so the new event shows now).
 */
export async function getCachedRawCalendarEvents(
  calendarId: string,
  timeMin: string,
  timeMax: string,
  options: { fresh?: boolean } = {},
): Promise<calendar_v3.Schema$Event[]> {
  const key = cacheKey(calendarId, timeMin, timeMax);

  if (options.fresh) {
    return refresh(key, calendarId, timeMin, timeMax);
  }

  const entry = cache.get(key);
  if (entry) {
    if (Date.now() - entry.timestamp >= CALENDAR_CACHE_TTL) {
      // Stale: kick off a background refresh but don't block on it. Swallow
      // errors here — the caller already has usable (stale) data.
      refresh(key, calendarId, timeMin, timeMax).catch((err) =>
        console.error("Background calendar refresh failed:", calendarId, err),
      );
    }
    return entry.data;
  }

  // Cold miss: must fetch. Concurrent misses share one upstream call.
  return refresh(key, calendarId, timeMin, timeMax);
}
