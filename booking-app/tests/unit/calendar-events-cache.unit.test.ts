import { afterEach, describe, expect, it, vi } from "vitest";

// Mock the Google client so the cache is exercised without network.
const listMock = vi.fn();
vi.mock("@/lib/googleClient", () => ({
  getCalendarClient: async () => ({
    events: { list: listMock },
  }),
}));

import {
  getCachedRawCalendarEvents,
  invalidateCalendarEventsCache,
  _getCalendarEventsCacheSizeForTesting,
  _resetCalendarEventsCacheForTesting,
} from "@/lib/calendarEventsCache";

const oncePage = (items: any[]) => ({
  data: { items, nextPageToken: undefined },
});

afterEach(() => {
  _resetCalendarEventsCacheForTesting();
  listMock.mockReset();
});

const RANGE = ["2026-09-01T00:00:00Z", "2026-10-01T00:00:00Z"] as const;

describe("calendarEventsCache", () => {
  it("fetches once on a cold miss and returns the events", async () => {
    listMock.mockResolvedValueOnce(oncePage([{ id: "a" }]));
    const events = await getCachedRawCalendarEvents("cal1", ...RANGE);
    expect(events).toEqual([{ id: "a" }]);
    expect(listMock).toHaveBeenCalledTimes(1);
  });

  it("serves a fresh cache hit without refetching", async () => {
    listMock.mockResolvedValueOnce(oncePage([{ id: "a" }]));
    await getCachedRawCalendarEvents("cal1", ...RANGE);
    await getCachedRawCalendarEvents("cal1", ...RANGE);
    expect(listMock).toHaveBeenCalledTimes(1);
  });

  it("coalesces concurrent cold misses into a single upstream fetch", async () => {
    let resolve: (v: any) => void;
    listMock.mockReturnValueOnce(
      new Promise((r) => {
        resolve = r;
      }),
    );
    const p1 = getCachedRawCalendarEvents("cal1", ...RANGE);
    const p2 = getCachedRawCalendarEvents("cal1", ...RANGE);
    resolve!(oncePage([{ id: "a" }]));
    const [e1, e2] = await Promise.all([p1, p2]);
    expect(e1).toEqual([{ id: "a" }]);
    expect(e2).toEqual([{ id: "a" }]);
    expect(listMock).toHaveBeenCalledTimes(1);
  });

  it("keys the cache by range, so a different range fetches separately", async () => {
    listMock
      .mockResolvedValueOnce(oncePage([{ id: "a" }]))
      .mockResolvedValueOnce(oncePage([{ id: "b" }]));
    const a = await getCachedRawCalendarEvents("cal1", ...RANGE);
    const b = await getCachedRawCalendarEvents(
      "cal1",
      "2026-10-01T00:00:00Z",
      "2026-11-01T00:00:00Z",
    );
    expect(a).toEqual([{ id: "a" }]);
    expect(b).toEqual([{ id: "b" }]);
    expect(listMock).toHaveBeenCalledTimes(2);
  });

  it("fresh=true bypasses a warm cache and refetches", async () => {
    listMock
      .mockResolvedValueOnce(oncePage([{ id: "a" }]))
      .mockResolvedValueOnce(oncePage([{ id: "a2" }]));
    await getCachedRawCalendarEvents("cal1", ...RANGE);
    const refreshed = await getCachedRawCalendarEvents("cal1", ...RANGE, {
      fresh: true,
    });
    expect(refreshed).toEqual([{ id: "a2" }]);
    expect(listMock).toHaveBeenCalledTimes(2);
  });

  it("evicts oldest entries beyond the cache size cap", async () => {
    // MAX_CACHE_ENTRIES is 500. Insert 501 distinct ranges: the size must stay
    // capped and the oldest entry must be gone (a refetch hits Google again).
    listMock.mockImplementation(async () => oncePage([{ id: "x" }]));
    for (let i = 0; i < 501; i++) {
      await getCachedRawCalendarEvents(
        "cal1",
        `2026-01-01T00:00:00.${String(i).padStart(3, "0")}Z`,
        "2026-02-01T00:00:00Z",
      );
    }
    expect(_getCalendarEventsCacheSizeForTesting()).toBe(500);

    const callsBefore = listMock.mock.calls.length;
    // Oldest range (i=0) was evicted → refetches upstream.
    await getCachedRawCalendarEvents(
      "cal1",
      "2026-01-01T00:00:00.000Z",
      "2026-02-01T00:00:00Z",
    );
    expect(listMock.mock.calls.length).toBe(callsBefore + 1);

    // Newest range (i=500) is still cached → no extra upstream call.
    await getCachedRawCalendarEvents(
      "cal1",
      "2026-01-01T00:00:00.500Z",
      "2026-02-01T00:00:00Z",
    );
    expect(listMock.mock.calls.length).toBe(callsBefore + 1);
  });

  it("serves stale data immediately and refreshes in the background", async () => {
    vi.useFakeTimers();
    try {
      listMock.mockResolvedValueOnce(oncePage([{ id: "old" }]));
      await getCachedRawCalendarEvents("cal1", ...RANGE);

      // Past the TTL: the stale entry is returned without awaiting Google.
      vi.advanceTimersByTime(61_000);
      listMock.mockResolvedValueOnce(oncePage([{ id: "new" }]));
      const stale = await getCachedRawCalendarEvents("cal1", ...RANGE);
      expect(stale).toEqual([{ id: "old" }]);
      expect(listMock).toHaveBeenCalledTimes(2); // background refresh started

      // Once the background refresh settles, the cache holds the new data.
      await vi.runAllTimersAsync();
      const after = await getCachedRawCalendarEvents("cal1", ...RANGE);
      expect(after).toEqual([{ id: "new" }]);
      expect(listMock).toHaveBeenCalledTimes(2); // served from refreshed cache
    } finally {
      vi.useRealTimers();
    }
  });

  it("fresh=true does not reuse an in-flight fetch started earlier", async () => {
    // A slow fetch is already in flight (e.g. started before a mutation)...
    let resolveOld: (v: any) => void;
    listMock.mockReturnValueOnce(
      new Promise((r) => {
        resolveOld = r;
      }),
    );
    const oldFetch = getCachedRawCalendarEvents("cal1", ...RANGE);

    // ...so a fresh caller must trigger its own upstream fetch, not join it.
    listMock.mockResolvedValueOnce(oncePage([{ id: "post-mutation" }]));
    const freshData = await getCachedRawCalendarEvents("cal1", ...RANGE, {
      fresh: true,
    });
    expect(freshData).toEqual([{ id: "post-mutation" }]);
    expect(listMock).toHaveBeenCalledTimes(2);

    // The superseded fetch resolving late must not clobber the newer data.
    resolveOld!(oncePage([{ id: "pre-mutation" }]));
    await oldFetch;
    const cached = await getCachedRawCalendarEvents("cal1", ...RANGE);
    expect(cached).toEqual([{ id: "post-mutation" }]);
    expect(listMock).toHaveBeenCalledTimes(2);
  });

  it("invalidates a single calendar's entries, leaving others cached", async () => {
    listMock
      .mockResolvedValueOnce(oncePage([{ id: "a" }]))
      .mockResolvedValueOnce(oncePage([{ id: "b" }]));
    await getCachedRawCalendarEvents("cal1", ...RANGE);
    await getCachedRawCalendarEvents("cal2", ...RANGE);

    invalidateCalendarEventsCache("cal1");

    listMock.mockResolvedValueOnce(oncePage([{ id: "a2" }]));
    const cal1 = await getCachedRawCalendarEvents("cal1", ...RANGE);
    const cal2 = await getCachedRawCalendarEvents("cal2", ...RANGE);
    expect(cal1).toEqual([{ id: "a2" }]); // refetched
    expect(cal2).toEqual([{ id: "b" }]); // still cached
    expect(listMock).toHaveBeenCalledTimes(3);
  });

  it("invalidates everything when no calendarId is given", async () => {
    listMock
      .mockResolvedValueOnce(oncePage([{ id: "a" }]))
      .mockResolvedValueOnce(oncePage([{ id: "b" }]));
    await getCachedRawCalendarEvents("cal1", ...RANGE);
    await getCachedRawCalendarEvents("cal2", ...RANGE);

    invalidateCalendarEventsCache();
    expect(_getCalendarEventsCacheSizeForTesting()).toBe(0);
  });

  it("paginates via nextPageToken", async () => {
    listMock
      .mockResolvedValueOnce({
        data: { items: [{ id: "a" }], nextPageToken: "tok" },
      })
      .mockResolvedValueOnce({ data: { items: [{ id: "b" }] } });
    const events = await getCachedRawCalendarEvents("cal1", ...RANGE);
    expect(events).toEqual([{ id: "a" }, { id: "b" }]);
    expect(listMock).toHaveBeenCalledTimes(2);
  });
});
