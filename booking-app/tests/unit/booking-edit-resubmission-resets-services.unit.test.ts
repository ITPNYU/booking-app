import { beforeEach, describe, expect, it, vi } from "vitest";

const mockServerBookingContents = vi.fn();
const mockServerUpdateDataByCalendarEventId = vi.fn();
const mockServerDeleteFieldsByCalendarEventId = vi.fn();
const mockServerSendBookingDetailEmail = vi.fn();
const mockFirstApproverEmails = vi.fn();
const mockDeleteEvent = vi.fn();
const mockInsertEvent = vi.fn();
const mockBookingContentsToDescription = vi.fn();
const mockGetTenantEmailConfig = vi.fn();
const mockSendHTMLEmail = vi.fn();
const mockLogServerBookingChange = vi.fn();
const mockCallXStateTransitionAPI = vi.fn();

vi.mock("@/components/src/server/admin", () => ({
  serverBookingContents: (...args: any[]) => mockServerBookingContents(...args),
  serverUpdateDataByCalendarEventId: (...args: any[]) =>
    mockServerUpdateDataByCalendarEventId(...args),
  serverDeleteFieldsByCalendarEventId: (...args: any[]) =>
    mockServerDeleteFieldsByCalendarEventId(...args),
  serverSendBookingDetailEmail: (...args: any[]) =>
    mockServerSendBookingDetailEmail(...args),
  firstApproverEmails: (...args: any[]) => mockFirstApproverEmails(...args),
}));

vi.mock("@/components/src/server/calendars", () => ({
  deleteEvent: (...args: any[]) => mockDeleteEvent(...args),
  insertEvent: (...args: any[]) => mockInsertEvent(...args),
  bookingContentsToDescription: (...args: any[]) =>
    mockBookingContentsToDescription(...args),
}));

vi.mock("@/components/src/server/emails", () => ({
  getTenantEmailConfig: (...args: any[]) => mockGetTenantEmailConfig(...args),
}));

vi.mock("@/app/lib/sendHTMLEmail", () => ({
  sendHTMLEmail: (...args: any[]) => mockSendHTMLEmail(...args),
}));

vi.mock("@/lib/firebase/server/adminDb", () => ({
  logServerBookingChange: (...args: any[]) => mockLogServerBookingChange(...args),
  serverGetDataByCalendarEventId: vi.fn().mockResolvedValue({
    calendarEventId: "new-cal-456",
    xstateData: { snapshot: { value: "Requested" } },
  }),
}));

vi.mock("@/components/src/server/db", () => ({
  callXStateTransitionAPI: (...args: any[]) => mockCallXStateTransitionAPI(...args),
}));

vi.mock("@/components/src/utils/statusFromXState", () => ({
  getStatusFromXState: () => "DECLINED",
}));

vi.mock("@/components/src/utils/tenantUtils", () => ({
  shouldUseXState: () => true,
}));

vi.mock("@/components/src/client/utils/serverDate", () => ({
  toFirebaseTimestampFromString: (s: string) => `ts(${s})`,
}));

vi.mock("firebase-admin/firestore", () => ({
  Timestamp: class MockTimestamp {
    static now() {
      return new MockTimestamp();
    }
    toDate() {
      return new Date();
    }
  },
}));

vi.mock("@/app/api/bookings/shared", () => ({
  buildBookingContents: (...args: any[]) => args[0],
  extractTenantFromRequest: () => "mc",
  getTenantRooms: vi.fn().mockResolvedValue([
    { roomId: 202, calendarId: "cal-room-202" },
    { roomId: 203, calendarId: "cal-room-203" },
  ]),
}));

import { PUT } from "@/app/api/bookings/edit/route";
import { NextRequest } from "next/server";

const createRequest = (body: any) =>
  new NextRequest("http://localhost:3000/api/bookings/edit", {
    method: "PUT",
    headers: new Headers({ "Content-Type": "application/json" }),
    body: JSON.stringify(body),
  });

describe("Edit resubmission resets declined services", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockServerBookingContents.mockResolvedValue({
      id: "booking-123",
      requestNumber: 100,
      roomId: "202",
      title: "Original Meeting",
      declinedAt: { __mock: "declinedAt" },
      // previously declined service decisions
      staffServiceApproved: false,
      equipmentServiceApproved: false,
      cateringServiceApproved: false,
      cleaningServiceApproved: false,
      securityServiceApproved: false,
      setupServiceApproved: false,
      origin: "user",
    });

    mockInsertEvent.mockResolvedValue({ id: "new-cal-456" });
    mockBookingContentsToDescription.mockResolvedValue("<p>desc</p>");
    mockFirstApproverEmails.mockResolvedValue(["liaison@nyu.edu"]);
    mockGetTenantEmailConfig.mockResolvedValue({
      schemaName: "Media Commons",
      emailNotifications: {
        requestedUser: "Thanks",
        requestedNeedsApproval: "Please review",
      } as any,
    });
    mockSendHTMLEmail.mockResolvedValue(undefined);
    mockServerSendBookingDetailEmail.mockResolvedValue(undefined);
    mockServerUpdateDataByCalendarEventId.mockResolvedValue(undefined);
    mockServerDeleteFieldsByCalendarEventId.mockResolvedValue(undefined);
    mockDeleteEvent.mockResolvedValue(undefined);
    mockCallXStateTransitionAPI.mockResolvedValue({ success: true, newState: "Requested" });
  });

  it("clears per-service approval booleans on edit of declined booking", async () => {
    const req = createRequest({
      email: "user@nyu.edu",
      selectedRooms: [{ roomId: 202, calendarId: "cal-room-202" }],
      allRooms: [],
      bookingCalendarInfo: {
        startStr: "2026-05-05T10:00:00.000Z",
        endStr: "2026-05-05T11:00:00.000Z",
      },
      data: { title: "Updated", department: "ITP" },
      calendarEventId: "old-cal-123",
      modifiedBy: "user@nyu.edu",
    });

    const res = await PUT(req);
    expect(res.status).toBe(200);

    // Update call uses old calendarEventId lookup but writes new calendarEventId
    const updateArgs = mockServerUpdateDataByCalendarEventId.mock.calls[0];
    expect(updateArgs[0]).toBe("bookings");
    expect(updateArgs[1]).toBe("old-cal-123");

    const updatedData = updateArgs[2];
    expect(updatedData.calendarEventId).toBe("new-cal-456");

    // Critical: reset service decisions
    expect(updatedData.staffServiceApproved).toBeNull();
    expect(updatedData.equipmentServiceApproved).toBeNull();
    expect(updatedData.cateringServiceApproved).toBeNull();
    expect(updatedData.cleaningServiceApproved).toBeNull();
    expect(updatedData.securityServiceApproved).toBeNull();
    expect(updatedData.setupServiceApproved).toBeNull();

    // Still runs XState edit transition for declined bookings
    expect(mockCallXStateTransitionAPI).toHaveBeenCalledWith(
      "new-cal-456",
      "edit",
      "user@nyu.edu",
      "mc",
    );
  });
});

