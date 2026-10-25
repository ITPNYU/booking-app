import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/firebase/firebase", () => ({
  clientGetDataByCalendarEventId: vi.fn(),
}));

import {
  cancel,
  checkOut,
  checkin,
  clientApproveBooking,
  noShow,
} from "@/components/src/client/bookingActionClient";

const NOTE = "Requester called ahead";

/** The JSON body sent to the first request whose URL ends with `path`. */
const bodySentTo = (fetchMock: ReturnType<typeof vi.fn>, path: string) => {
  const call = fetchMock.mock.calls.find(([url]) => String(url).endsWith(path));
  return call ? JSON.parse(call[1].body) : undefined;
};

describe("booking action notes", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_BASE_URL", "https://booking.test");
    fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ newState: "Canceled" }),
    });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("sends the approval note to /api/approve", async () => {
    await clientApproveBooking("cal-1", "admin@nyu.edu", "mc", NOTE);

    expect(bodySentTo(fetchMock, "/api/approve")).toEqual({
      id: "cal-1",
      email: "admin@nyu.edu",
      note: NOTE,
    });
  });

  it("sends the cancel note with the XState cancel event", async () => {
    await cancel("cal-1", "user@nyu.edu", "user", "mc", NOTE);

    expect(bodySentTo(fetchMock, "/api/xstate-transition")).toMatchObject({
      eventType: "cancel",
      reason: NOTE,
    });
  });

  it("sends the cancel note to the fallback when the XState cancel fails", async () => {
    fetchMock.mockImplementation(async (url: string) =>
      url.endsWith("/api/xstate-transition")
        ? { ok: false, status: 400, json: async () => ({ error: "nope" }) }
        : { ok: true, json: async () => ({}) },
    );

    await cancel("cal-1", "user@nyu.edu", "user", "mc", NOTE);

    expect(bodySentTo(fetchMock, "/api/cancel-processing")).toMatchObject({
      calendarEventId: "cal-1",
      note: NOTE,
    });
  });

  it("sends the no-show note with the XState no-show event", async () => {
    await noShow("cal-1", "pa@nyu.edu", "pa", "mc", NOTE);

    expect(bodySentTo(fetchMock, "/api/xstate-transition")).toMatchObject({
      eventType: "noShow",
      reason: NOTE,
    });
  });

  it("sends the check-in and check-out notes to their processing routes", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ newState: "Checked In" }),
    });

    await checkin("cal-1", "pa@nyu.edu", "mc", NOTE);
    await checkOut("cal-2", "pa@nyu.edu", "mc", "Left the room tidy");

    expect(bodySentTo(fetchMock, "/api/checkin-processing")).toMatchObject({
      calendarEventId: "cal-1",
      note: NOTE,
    });
    expect(bodySentTo(fetchMock, "/api/checkout-processing")).toMatchObject({
      calendarEventId: "cal-2",
      note: "Left the room tidy",
    });
  });
});
