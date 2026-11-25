import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/firebase/firebase", () => ({
  clientGetDataByCalendarEventId: vi.fn(),
}));

import { noShow } from "@/components/src/client/bookingActionClient";

describe("noShow failures", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("does not use the traditional fallback after an XState 401", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: "Unauthorized" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      noShow("calendar-7007", "nw2289@nyu.edu", "nw2289", "mc"),
    ).rejects.toThrow("Unauthorized");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toContain("/api/xstate-transition");
  });

  // The machine decides whether a booking can be marked no-show. The old
  // fallback stamped noShowedAt, logged a violation against the guest and
  // emailed them even though the booking's state had not changed.
  it("does not use the traditional fallback when the machine refuses", async () => {
    const error =
      "Invalid transition: Cannot execute 'noShow' from state 'Checked In'";
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      noShow("calendar-7007", "nw2289@nyu.edu", "nw2289", "mc"),
    ).rejects.toThrow(error);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toContain("/api/xstate-transition");
  });

  it("does not use the traditional fallback when the request cannot be sent", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("Failed to fetch"));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      noShow("calendar-7007", "nw2289@nyu.edu", "nw2289", "mc"),
    ).rejects.toThrow("Failed to fetch");

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
