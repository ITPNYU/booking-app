import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useParams: () => ({ tenant: "mc" }),
}));

import fetchCalendarEvents from "@/components/src/client/routes/booking/hooks/fetchCalendarEvents";
import type { RoomSetting } from "@/components/src/types";

const rooms = [
  { roomId: 202, calendarId: "cal-202" },
  { roomId: 220, calendarId: "cal-220" },
] as unknown as RoomSetting[];

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockResolvedValue({
    ok: true,
    json: async () => ({ "cal-202": [], "cal-220": [] }),
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  fetchMock.mockReset();
});

describe("fetchCalendarEvents enabled flag", () => {
  it("does not hit /api/calendarEvents while disabled, even on reload", async () => {
    const { result } = renderHook(() => fetchCalendarEvents(rooms, false));

    result.current.reloadExistingCalendarEvents();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.current.fetchingStatus).toBeNull();
  });

  it("fetches once it becomes enabled (entering a booking flow)", async () => {
    const { result, rerender } = renderHook(
      ({ enabled }) => fetchCalendarEvents(rooms, enabled),
      { initialProps: { enabled: false } },
    );
    expect(fetchMock).not.toHaveBeenCalled();

    rerender({ enabled: true });

    await waitFor(() => expect(result.current.fetchingStatus).toBe("loaded"));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain(
      "/api/calendarEvents?calendarIds=cal-202%2Ccal-220",
    );
  });

  it("aborts the in-flight request when it becomes disabled", async () => {
    let signal: AbortSignal | undefined;
    fetchMock.mockImplementation((_url: string, init: RequestInit) => {
      signal = init.signal ?? undefined;
      return new Promise(() => {}); // never settles
    });

    const { rerender } = renderHook(
      ({ enabled }) => fetchCalendarEvents(rooms, enabled),
      { initialProps: { enabled: true } },
    );
    await waitFor(() => expect(signal).toBeDefined());
    expect(signal!.aborted).toBe(false);

    rerender({ enabled: false });

    expect(signal!.aborted).toBe(true);
  });

  it("still fetches by default when the flag is omitted", async () => {
    renderHook(() => fetchCalendarEvents(rooms));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  });
});
