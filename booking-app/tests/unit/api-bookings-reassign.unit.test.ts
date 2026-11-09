import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BookingStatusLabel, PagePermission } from "@/components/src/types";

const mocks = vi.hoisted(() => {
  const mockQueryGet = vi.fn();
  const mockTxUpdate = vi.fn();
  const mockTxGet = vi.fn();
  const mockCollection = vi.fn(() => ({
    where: () => ({ limit: () => ({ get: () => mockQueryGet() }) }),
  }));
  return {
    mockRequireSession: vi.fn(),
    mockResolveCallerRole: vi.fn(),
    mockRequesterIsBanned: vi.fn(),
    mockGetStatus: vi.fn(),
    mockLog: vi.fn(),
    mockBookingContents: vi.fn(),
    mockSendEmail: vi.fn(),
    mockUpdateCalendarEvent: vi.fn(),
    mockReplaceAttendee: vi.fn(),
    mockEmailConfig: vi.fn(),
    mockQueryGet,
    mockTxUpdate,
    mockTxGet,
    mockCollection,
    firestore: () => ({
      collection: (name: string) => (mockCollection as any)(name),
      runTransaction: async (fn: (tx: unknown) => Promise<unknown>) =>
        fn({ get: mockTxGet, update: mockTxUpdate }),
    }),
  };
});

vi.mock("@/lib/api/requireSession", () => ({
  requireSession: () => mocks.mockRequireSession(),
}));
vi.mock("@/lib/api/authz", () => ({
  resolveCallerRole: (...args: unknown[]) =>
    mocks.mockResolveCallerRole(...args),
}));
vi.mock("@/lib/bookingBan", () => ({
  requesterIsBanned: (...args: unknown[]) =>
    mocks.mockRequesterIsBanned(...args),
}));
vi.mock("@/lib/firebase/server/firebaseAdmin", () => ({
  default: { firestore: mocks.firestore },
}));
vi.mock("@/lib/firebase/server/adminDb", () => ({
  logServerBookingChange: (...args: unknown[]) => mocks.mockLog(...args),
}));
vi.mock("@/components/src/utils/statusFromXState", () => ({
  getStatusFromXState: (...args: unknown[]) => mocks.mockGetStatus(...args),
}));
vi.mock("@/components/src/server/admin", () => ({
  serverBookingContents: (...args: unknown[]) =>
    mocks.mockBookingContents(...args),
  serverSendBookingDetailEmail: (...args: unknown[]) =>
    mocks.mockSendEmail(...args),
}));
vi.mock("@/components/src/server/calendars", () => ({
  updateCalendarEvent: (...args: unknown[]) =>
    mocks.mockUpdateCalendarEvent(...args),
  replaceCalendarAttendee: (...args: unknown[]) =>
    mocks.mockReplaceAttendee(...args),
}));
vi.mock("@/components/src/server/emails", () => ({
  getTenantEmailConfig: (...args: unknown[]) => mocks.mockEmailConfig(...args),
}));

import { PUT } from "@/app/api/bookings/reassign/route";

const validBody = {
  calendarEventId: "evt-1",
  netId: "new456",
  firstName: "Pat",
  lastName: "Lee",
  nNumber: "N12345678",
  phoneNumber: "2125550199",
};

const existingBooking = {
  calendarEventId: "evt-1",
  email: "old123@nyu.edu",
  netId: "old123",
  firstName: "Sam",
  lastName: "Kim",
  roomId: "202",
  requestNumber: 4321,
  origin: "user",
  role: "Student",
  secondaryEmail: "",
};

const createRequest = (body: unknown, tenant = "mc") =>
  new NextRequest("http://localhost:3000/api/bookings/reassign", {
    method: "PUT",
    headers: new Headers({
      "Content-Type": "application/json",
      "x-tenant": tenant,
    }),
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

describe("PUT /api/bookings/reassign", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mockRequireSession.mockResolvedValue({
      email: "admin@nyu.edu",
      netId: "admin",
    });
    mocks.mockResolveCallerRole.mockResolvedValue(PagePermission.ADMIN);
    mocks.mockRequesterIsBanned.mockResolvedValue(false);
    mocks.mockGetStatus.mockReturnValue(BookingStatusLabel.APPROVED);
    mocks.mockQueryGet.mockResolvedValue({
      empty: false,
      docs: [{ ref: { id: "booking-doc-1" } }],
    });
    mocks.mockTxGet.mockResolvedValue({ data: () => ({ ...existingBooking }) });
    mocks.mockLog.mockResolvedValue(undefined);
    mocks.mockBookingContents.mockResolvedValue({ roomId: "202" });
    mocks.mockUpdateCalendarEvent.mockResolvedValue(undefined);
    mocks.mockReplaceAttendee.mockResolvedValue(true);
    mocks.mockSendEmail.mockResolvedValue({ ok: true });
    mocks.mockEmailConfig.mockResolvedValue({
      schemaName: "Media Commons",
      emailNotifications: { approvedUser: "Your reservation is approved." },
    });
  });

  it("returns 401 without a session", async () => {
    mocks.mockRequireSession.mockResolvedValue(null);
    const res = await PUT(createRequest(validBody));
    expect(res.status).toBe(401);
    expect(mocks.mockTxUpdate).not.toHaveBeenCalled();
  });

  it("returns 400 for an unknown tenant", async () => {
    const res = await PUT(createRequest(validBody, "nope"));
    expect(res.status).toBe(400);
  });

  it.each([
    PagePermission.BOOKING,
    PagePermission.PA,
    PagePermission.LIAISON,
    PagePermission.SERVICES,
  ])("returns 403 for %s callers", async (role) => {
    mocks.mockResolveCallerRole.mockResolvedValue(role);
    const res = await PUT(createRequest(validBody));
    expect(res.status).toBe(403);
    expect(mocks.mockTxUpdate).not.toHaveBeenCalled();
  });

  it("returns 400 on invalid JSON", async () => {
    const res = await PUT(createRequest("{oops"));
    expect(res.status).toBe(400);
  });

  it("returns 400 when the phone number is invalid", async () => {
    const res = await PUT(createRequest({ ...validBody, phoneNumber: "12" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe(
      "Enter a valid 10 digit phone number",
    );
  });

  it("refuses a banned new requester", async () => {
    mocks.mockRequesterIsBanned.mockResolvedValue(true);
    const res = await PUT(createRequest(validBody));
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe(
      "new456@nyu.edu is banned from booking",
    );
    expect(mocks.mockRequesterIsBanned).toHaveBeenCalledWith(
      "new456@nyu.edu",
      "mc",
    );
    expect(mocks.mockTxUpdate).not.toHaveBeenCalled();
  });

  it("returns 404 when the booking does not exist", async () => {
    mocks.mockQueryGet.mockResolvedValue({ empty: true, docs: [] });
    const res = await PUT(createRequest(validBody));
    expect(res.status).toBe(404);
  });

  it.each([
    BookingStatusLabel.DECLINED,
    BookingStatusLabel.CHECKED_IN,
    BookingStatusLabel.CANCELED,
    BookingStatusLabel.CLOSED,
  ])("refuses a %s booking", async (status) => {
    mocks.mockGetStatus.mockReturnValue(status);
    const res = await PUT(createRequest(validBody));
    expect(res.status).toBe(422);
    expect(mocks.mockTxUpdate).not.toHaveBeenCalled();
    expect(mocks.mockSendEmail).not.toHaveBeenCalled();
  });

  it("refuses to reassign a booking to its current requester", async () => {
    const res = await PUT(createRequest({ ...validBody, netId: "OLD123" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe(
      "old123@nyu.edu is already the requester",
    );
  });

  it("moves the booking, logs it, updates the calendar and emails both people", async () => {
    const res = await PUT(createRequest(validBody));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      success: true,
      email: "new456@nyu.edu",
      previousEmail: "old123@nyu.edu",
    });

    expect(mocks.mockCollection).toHaveBeenCalledWith("mc-bookings");
    expect(mocks.mockTxUpdate).toHaveBeenCalledWith(
      { id: "booking-doc-1" },
      {
        email: "new456@nyu.edu",
        netId: "new456",
        firstName: "Pat",
        lastName: "Lee",
        nNumber: "N12345678",
        phoneNumber: "2125550199",
      },
    );

    expect(mocks.mockLog).toHaveBeenCalledWith({
      bookingId: "booking-doc-1",
      calendarEventId: "evt-1",
      status: BookingStatusLabel.MODIFIED,
      changedBy: "admin@nyu.edu",
      requestNumber: 4321,
      note: "Requester changed from old123@nyu.edu to new456@nyu.edu",
      tenant: "mc",
    });

    expect(mocks.mockUpdateCalendarEvent).toHaveBeenCalledWith(
      "evt-1",
      {},
      { roomId: "202" },
      "mc",
    );
    expect(mocks.mockReplaceAttendee).toHaveBeenCalledWith({
      calendarEventId: "evt-1",
      roomId: "202",
      previousEmail: "old123@nyu.edu",
      newEmail: "new456@nyu.edu",
      keepPreviousAttendee: false,
      tenant: "mc",
    });

    expect(mocks.mockSendEmail).toHaveBeenCalledTimes(2);
    expect(mocks.mockSendEmail).toHaveBeenCalledWith({
      calendarEventId: "evt-1",
      targetEmail: "new456@nyu.edu",
      headerMessage:
        "This reservation has been assigned to you.<br /><br />Your reservation is approved.",
      status: BookingStatusLabel.APPROVED,
      tenant: "mc",
      subjectStatusOverride: "REASSIGNED",
    });
    expect(mocks.mockSendEmail).toHaveBeenCalledWith({
      calendarEventId: "evt-1",
      targetEmail: "old123@nyu.edu",
      headerMessage:
        "This reservation has been reassigned to Pat Lee (new456@nyu.edu). It no longer appears in your bookings.",
      status: BookingStatusLabel.APPROVED,
      tenant: "mc",
      subjectStatusOverride: "REASSIGNED",
    });
  });

  it("logs the history row before sending emails so they include it", async () => {
    await PUT(createRequest(validBody));
    const logOrder = mocks.mockLog.mock.invocationCallOrder[0];
    const firstEmailOrder = mocks.mockSendEmail.mock.invocationCallOrder[0];
    expect(logOrder).toBeLessThan(firstEmailOrder);
  });

  it("lets super admins reassign", async () => {
    mocks.mockResolveCallerRole.mockResolvedValue(PagePermission.SUPER_ADMIN);
    const res = await PUT(createRequest(validBody));
    expect(res.status).toBe(200);
  });

  it("skips the emails the admin turned off", async () => {
    const res = await PUT(
      createRequest({
        ...validBody,
        notifyNewRequester: false,
        notifyPreviousRequester: false,
      }),
    );
    expect(res.status).toBe(200);
    expect(mocks.mockSendEmail).not.toHaveBeenCalled();
  });

  it("keeps the old requester invited when they are also the secondary contact", async () => {
    mocks.mockTxGet.mockResolvedValue({
      data: () => ({ ...existingBooking, secondaryEmail: "OLD123@nyu.edu" }),
    });
    await PUT(createRequest(validBody));
    expect(mocks.mockReplaceAttendee).toHaveBeenCalledWith(
      expect.objectContaining({ keepPreviousAttendee: true }),
    );
  });

  it("reports follow-up failures as a warning without failing the request", async () => {
    mocks.mockReplaceAttendee.mockRejectedValue(new Error("calendar down"));
    mocks.mockSendEmail.mockResolvedValue({ ok: false, status: 500 });

    const res = await PUT(createRequest(validBody));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.warning).toBe(
      "The booking was reassigned to Pat Lee, but the Google Calendar invitation was not moved to the new requester, and the email to the new requester was not sent, and the email to the previous requester was not sent.",
    );
  });

  it("returns 500 when the booking write fails", async () => {
    mocks.mockTxUpdate.mockImplementation(() => {
      throw new Error("write failed");
    });
    const res = await PUT(createRequest(validBody));
    expect(res.status).toBe(500);
    expect(mocks.mockLog).not.toHaveBeenCalled();
    expect(mocks.mockSendEmail).not.toHaveBeenCalled();
  });
});
