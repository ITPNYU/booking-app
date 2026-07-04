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
