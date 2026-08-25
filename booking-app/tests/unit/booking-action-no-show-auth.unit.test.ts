import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  shouldUseXState: vi.fn(),
}));

vi.mock("@/components/src/utils/tenantUtils", () => ({
  shouldUseXState: mocks.shouldUseXState,
}));

vi.mock("@/lib/firebase/firebase", () => ({
  clientGetDataByCalendarEventId: vi.fn(),
}));

import { noShow } from "@/components/src/client/bookingActionClient";

describe("noShow authentication failures", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.shouldUseXState.mockReturnValue(true);
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
});
