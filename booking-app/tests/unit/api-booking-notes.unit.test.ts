import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireSession: vi.fn(),
  resolveCallerRole: vi.fn(),
  logServerBookingChange: vi.fn(),
  serverGetDataByCalendarEventId: vi.fn(),
}));

vi.mock("@/lib/api/requireSession", () => ({
  requireSession: mocks.requireSession,
}));

vi.mock("@/lib/api/authz", () => ({
  resolveCallerRole: mocks.resolveCallerRole,
}));

vi.mock("@/lib/firebase/server/adminDb", () => ({
  logServerBookingChange: mocks.logServerBookingChange,
  serverGetDataByCalendarEventId: mocks.serverGetDataByCalendarEventId,
}));

import { POST } from "@/app/api/booking-notes/route";
import { BookingStatusLabel, PagePermission } from "@/components/src/types";

const createRequest = (body: unknown, tenant = "mc") =>
  ({
    json: async () => {
      if (body === "bad-json") throw new SyntaxError("Unexpected token");
      return body;
    },
    headers: new Headers({ "x-tenant": tenant }),
  }) as any;

describe("POST /api/booking-notes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireSession.mockResolvedValue({
      email: "pa@nyu.edu",
      netId: "pa",
    });
    mocks.resolveCallerRole.mockResolvedValue(PagePermission.PA);
    mocks.serverGetDataByCalendarEventId.mockResolvedValue({
      id: "booking-db-id",
      requestNumber: 42,
    });
  });

  it("adds a NOTE history entry under the signed-in user", async () => {
    const response = await POST(
      createRequest({
        calendarEventId: "evt-1",
        note: "  Called the requester about parking  ",
        changedBy: "forged@nyu.edu",
      }),
    );

    expect(response.status).toBe(201);
    expect(mocks.resolveCallerRole).toHaveBeenCalledWith(
      { email: "pa@nyu.edu", netId: "pa" },
      "mc",
      { includeServiceApprovers: true },
    );
    expect(mocks.logServerBookingChange).toHaveBeenCalledWith({
      bookingId: "booking-db-id",
      calendarEventId: "evt-1",
      status: BookingStatusLabel.NOTE,
      changedBy: "pa@nyu.edu",
      requestNumber: 42,
      note: "Called the requester about parking",
      tenant: "mc",
    });
  });

  it.each([
    PagePermission.LIAISON,
    PagePermission.SERVICES,
    PagePermission.ADMIN,
    PagePermission.SUPER_ADMIN,
  ])("lets a %s add a note", async (role) => {
    mocks.resolveCallerRole.mockResolvedValue(role);

    const response = await POST(
      createRequest({ calendarEventId: "evt-1", note: "ok" }),
    );

    expect(response.status).toBe(201);
  });

  it("refuses a requester (BOOKING role)", async () => {
    mocks.resolveCallerRole.mockResolvedValue(PagePermission.BOOKING);

    const response = await POST(
      createRequest({ calendarEventId: "evt-1", note: "hi" }),
    );

    expect(response.status).toBe(403);
    expect(mocks.logServerBookingChange).not.toHaveBeenCalled();
  });

  it("requires a session", async () => {
    mocks.requireSession.mockResolvedValue(null);

    const response = await POST(
      createRequest({ calendarEventId: "evt-1", note: "hi" }),
    );

    expect(response.status).toBe(401);
    expect(mocks.resolveCallerRole).not.toHaveBeenCalled();
  });

  it.each([
    ["a missing note", { calendarEventId: "evt-1" }],
    ["a blank note", { calendarEventId: "evt-1", note: "   " }],
    ["a missing booking id", { note: "hi" }],
    ["a body that isn't JSON", "bad-json"],
  ])("returns 400 for %s", async (_label, body) => {
    const response = await POST(createRequest(body));

    expect(response.status).toBe(400);
    expect(mocks.logServerBookingChange).not.toHaveBeenCalled();
  });

  it("returns 404 when the booking doesn't exist", async () => {
    mocks.serverGetDataByCalendarEventId.mockResolvedValue(null);

    const response = await POST(
      createRequest({ calendarEventId: "missing", note: "hi" }),
    );

    expect(response.status).toBe(404);
    expect(mocks.logServerBookingChange).not.toHaveBeenCalled();
  });
});
