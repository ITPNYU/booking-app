import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { BookingStatusLabel } from "@/components/src/types";

const mockServerBookingContents = vi.fn();
const mockServerUpdateDataByCalendarEventId = vi.fn();
const mockServerGetDataByCalendarEventId = vi.fn();
const mockFinalApprove = vi.fn();
const mockLogServerBookingChange = vi.fn();
const mockDeleteEvent = vi.fn();
const mockInsertEvent = vi.fn();
const mockBookingContentsToDescription = vi.fn();
const mockGetMediaCommonsServices = vi.fn();
const mockServerSendBookingDetailEmail = vi.fn();
const mockCreateActor = vi.fn();
const mockGetTenantRooms = vi.fn();

vi.mock("@/components/src/server/admin", () => ({
  serverBookingContents: (...args: any[]) => mockServerBookingContents(...args),
  serverUpdateDataByCalendarEventId: (...args: any[]) =>
    mockServerUpdateDataByCalendarEventId(...args),
  finalApprove: (...args: any[]) => mockFinalApprove(...args),
  serverSendBookingDetailEmail: (...args: any[]) =>
    mockServerSendBookingDetailEmail(...args),
}));

vi.mock("@/components/src/server/calendars", () => ({
  deleteEvent: (...args: any[]) => mockDeleteEvent(...args),
  insertEvent: (...args: any[]) => mockInsertEvent(...args),
  bookingContentsToDescription: (...args: any[]) =>
    mockBookingContentsToDescription(...args),
}));

vi.mock("@/lib/firebase/server/adminDb", () => ({
  logServerBookingChange: (...args: any[]) =>
    mockLogServerBookingChange(...args),
  serverGetDataByCalendarEventId: (...args: any[]) =>
    mockServerGetDataByCalendarEventId(...args),
}));

vi.mock("@/app/api/bookings/shared", () => ({
  buildBookingContents: (
    data: any,
    _rooms: any,
    _start: any,
    _end: any,
    status: string,
  ) => ({ ...data, status }),
  extractTenantFromRequest: () => "mc",
  getTenantFlags: () => ({
    isMediaCommons: true,
    isITP: false,
    usesXState: true,
  }),
  getTenantRooms: (...args: any[]) => mockGetTenantRooms(...args),
}));

vi.mock("@/lib/tenant/serverGetTenantResources", () => ({
  serverGetTenantResources: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/components/src/utils/tenantUtils", () => ({
  getMediaCommonsServices: (...args: any[]) =>
    mockGetMediaCommonsServices(...args),
  isMediaCommons: (tenant: string) => tenant === "mc",
}));

vi.mock("@/components/src/client/utils/serverDate", () => ({
  toFirebaseTimestampFromString: (s: string) => `ts(${s})`,
}));

vi.mock("firebase-admin/firestore", () => ({
  Timestamp: class MockTimestamp {
    static now() {
      return { __now: true };
    }
  },
}));

vi.mock("xstate", () => ({
  createActor: (...args: any[]) => mockCreateActor(...args),
}));

vi.mock("@/lib/stateMachines/mcBookingMachine", () => ({
  mcBookingMachine: { id: "MC Booking Request" },
}));

vi.mock("@/lib/stateMachines/itpBookingMachine", () => ({
  itpBookingMachine: { id: "ITP Booking Request" },
}));

import { PUT } from "@/app/api/bookings/modification/route";

const createRequest = (body: object) =>
  new NextRequest("http://localhost:3000/api/bookings/modification", {
    method: "PUT",
    headers: new Headers({ "Content-Type": "application/json" }),
    body: JSON.stringify(body),
  });

const modificationBody = {
  email: "user@nyu.edu",
  selectedRooms: [{ roomId: "202", calendarId: "cal-room-202" }],
  allRooms: [],
  bookingCalendarInfo: {
    startStr: "2026-05-05T14:00:00.000Z",
    endStr: "2026-05-05T16:00:00.000Z",
  },
  data: { title: "Updated Session", department: "ITP" },
  calendarEventId: "old-cal-123",
  modifiedBy: "pa@nyu.edu",
};

describe("Checked In booking modification", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockServerBookingContents.mockResolvedValue({
      id: "booking-123",
      requestNumber: 100,
      roomId: "202",
      title: "Original Session",
    });
    mockGetTenantRooms.mockResolvedValue([
      { roomId: "202", calendarId: "cal-room-202" },
    ]);
    mockInsertEvent.mockResolvedValue({ id: "new-cal-456" });
    mockBookingContentsToDescription.mockResolvedValue("<p>details</p>");
    mockGetMediaCommonsServices.mockReturnValue({
      staff: false,
      equipment: false,
    });
    mockCreateActor.mockReturnValue({
      start: vi.fn(),
      stop: vi.fn(),
      getSnapshot: vi.fn().mockReturnValue({
        status: "active",
        value: "Approved",
        historyValue: {},
        context: {},
        children: {},
      }),
    });
    mockServerUpdateDataByCalendarEventId.mockResolvedValue(undefined);
    mockDeleteEvent.mockResolvedValue(undefined);
    mockFinalApprove.mockResolvedValue(undefined);
    mockLogServerBookingChange.mockResolvedValue(undefined);
    mockServerSendBookingDetailEmail.mockResolvedValue(undefined);
  });

  it("keeps Checked In status, timestamps, and calendar prefix", async () => {
    const checkedInAt = { seconds: 1710000000 };
    mockServerGetDataByCalendarEventId.mockResolvedValue({
      id: "booking-123",
      email: "user@nyu.edu",
      origin: "user",
      finalApprovedAt: { seconds: 1700000000 },
      finalApprovedBy: "admin@nyu.edu",
      checkedInAt,
      checkedInBy: "pa@nyu.edu",
      equipmentCheckedOut: true,
      requestedAt: { seconds: 1690000000 },
      xstateData: {
        machineId: "MC Booking Request",
        snapshot: {
          value: "Checked In",
          historyValue: { current: "Checked In" },
          context: { calendarEventId: "old-cal-123", origin: "user" },
        },
      },
    });

    const res = await PUT(createRequest(modificationBody));
    expect(res.status).toBe(200);

    expect(mockInsertEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        title: expect.stringContaining(`[${BookingStatusLabel.CHECKED_IN}]`),
      }),
    );

    const updatedData = mockServerUpdateDataByCalendarEventId.mock.calls[0][2];
    expect(updatedData.checkedInAt).toEqual(checkedInAt);
    expect(updatedData.checkedInBy).toBe("pa@nyu.edu");
    expect(updatedData.equipmentCheckedOut).toBe(true);
    expect(updatedData.requestedAt).toEqual({ seconds: 1690000000 });

    const xstateUpdate = mockServerUpdateDataByCalendarEventId.mock.calls[1][2];
    expect(xstateUpdate.xstateData.snapshot.value).toBe("Checked In");
    expect(xstateUpdate.xstateData.snapshot.historyValue).toEqual({
      current: "Checked In",
    });
    expect(xstateUpdate.xstateData.snapshot.context.calendarEventId).toBe(
      "new-cal-456",
    );
    expect(mockCreateActor).not.toHaveBeenCalled();

    expect(mockFinalApprove).not.toHaveBeenCalled();
    expect(mockLogServerBookingChange).toHaveBeenCalledWith(
      expect.objectContaining({
        status: BookingStatusLabel.MODIFIED,
        changedBy: "pa@nyu.edu",
        calendarEventId: "new-cal-456",
        note: "Booking modified while checked in",
      }),
    );
    expect(mockServerSendBookingDetailEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        calendarEventId: "new-cal-456",
        targetEmail: "user@nyu.edu",
        headerMessage: "Your reservation has been updated.",
        status: BookingStatusLabel.CHECKED_IN,
      }),
    );
  });

  it("still re-approves Approved bookings", async () => {
    mockServerGetDataByCalendarEventId.mockResolvedValue({
      id: "booking-123",
      origin: "user",
      finalApprovedAt: { seconds: 1700000000 },
      finalApprovedBy: "admin@nyu.edu",
      xstateData: { snapshot: { value: "Approved" } },
    });

    const res = await PUT(createRequest(modificationBody));
    expect(res.status).toBe(200);

    expect(mockInsertEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        title: expect.stringContaining(`[${BookingStatusLabel.APPROVED}]`),
      }),
    );

    const xstateUpdate = mockServerUpdateDataByCalendarEventId.mock.calls[1][2];
    expect(xstateUpdate.xstateData.snapshot.value).toBe("Approved");

    expect(mockFinalApprove).toHaveBeenCalledWith(
      "new-cal-456",
      "pa@nyu.edu",
      "mc",
      "Approved via booking modification",
    );
    expect(mockLogServerBookingChange).not.toHaveBeenCalled();
    expect(mockServerSendBookingDetailEmail).not.toHaveBeenCalled();
  });

  it("rejects bookings that are not Approved or Checked In", async () => {
    mockServerGetDataByCalendarEventId.mockResolvedValue({
      id: "booking-123",
      origin: "user",
      xstateData: { snapshot: { value: "Requested" } },
    });

    const res = await PUT(createRequest(modificationBody));
    expect(res.status).toBe(409);
    expect(mockInsertEvent).not.toHaveBeenCalled();
    expect(mockFinalApprove).not.toHaveBeenCalled();
  });

  it.each([
    ["Canceled", { canceledAt: { seconds: 1720000000 } }],
    ["Declined", { declinedAt: { seconds: 1720000000 } }],
    ["Checked Out", { checkedOutAt: { seconds: 1720000000 } }],
    ["Closed", { closedAt: { seconds: 1720000000 } }],
    ["No Show", { noShowedAt: { seconds: 1720000000 } }],
  ])(
    "rejects a %s booking even when finalApprovedAt is still set",
    async (xstateValue, extra) => {
      mockServerGetDataByCalendarEventId.mockResolvedValue({
        id: "booking-123",
        origin: "user",
        finalApprovedAt: { seconds: 1700000000 },
        firstApprovedAt: { seconds: 1695000000 },
        ...extra,
        xstateData: { snapshot: { value: xstateValue } },
      });

      const res = await PUT(createRequest(modificationBody));
      expect(res.status).toBe(409);
      expect(mockInsertEvent).not.toHaveBeenCalled();
      expect(mockFinalApprove).not.toHaveBeenCalled();
    },
  );

  it("still succeeds when a checked-in modification cannot be logged", async () => {
    mockServerGetDataByCalendarEventId.mockResolvedValue({
      origin: "user",
      email: "user@nyu.edu",
      finalApprovedAt: { seconds: 1700000000 },
      checkedInAt: { seconds: 1710000000 },
      xstateData: { snapshot: { value: "Checked In" } },
    });
    mockServerBookingContents.mockResolvedValue({
      requestNumber: 100,
      roomId: "202",
      title: "Original Session",
    });

    const res = await PUT(createRequest(modificationBody));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      result: "success",
      calendarEventId: "new-cal-456",
    });
    expect(mockInsertEvent).toHaveBeenCalled();
    expect(mockLogServerBookingChange).not.toHaveBeenCalled();
    expect(mockServerSendBookingDetailEmail).toHaveBeenCalled();
  });

  it("still succeeds when history logging throws after the mutation", async () => {
    mockServerGetDataByCalendarEventId.mockResolvedValue({
      id: "booking-123",
      email: "user@nyu.edu",
      origin: "user",
      finalApprovedAt: { seconds: 1700000000 },
      checkedInAt: { seconds: 1710000000 },
      xstateData: { snapshot: { value: "Checked In" } },
    });
    mockLogServerBookingChange.mockRejectedValueOnce(
      new Error("Firestore unavailable"),
    );

    const res = await PUT(createRequest(modificationBody));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      result: "success",
      calendarEventId: "new-cal-456",
    });
    expect(mockLogServerBookingChange).toHaveBeenCalled();
    expect(mockServerSendBookingDetailEmail).toHaveBeenCalled();
  });
});
