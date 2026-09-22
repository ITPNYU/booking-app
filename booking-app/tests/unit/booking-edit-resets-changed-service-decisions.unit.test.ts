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

vi.mock("@/lib/tenant/getCachedTenantSchema", () => ({
  getCachedTenantSchema: vi.fn().mockResolvedValue({
    form: {
      productionSchedule: {
        enabled: false,
        requiredAboveHours: 4,
      },
    },
  }),
}));

vi.mock("@/lib/tenant/serverGetTenantResources", () => ({
  serverGetTenantResources: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/components/src/server/db", () => ({
  callXStateTransitionAPI: (...args: any[]) => mockCallXStateTransitionAPI(...args),
}));

const mockGetStatusFromXState = vi.fn();
vi.mock("@/components/src/utils/statusFromXState", () => ({
  getStatusFromXState: (...args: any[]) => mockGetStatusFromXState(...args),
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

/** Saved service requests: staff and catering on room 202, security off. */
const savedServiceRequests = {
  staffingServices: "audio_tech",
  catering: "yes",
  cateringByRoom: { "202": "yes" },
  chartFieldForCateringByRoom: { "202": "AAAAA-BBBBB" },
  hireSecurity: "",
};

const savedBooking = (overrides: Record<string, unknown> = {}) => ({
  id: "booking-123",
  requestNumber: 100,
  roomId: "202",
  title: "Original Meeting",
  department: "ITP",
  origin: "user",
  ...savedServiceRequests,
  ...overrides,
});

const submit = (data: Record<string, unknown>) =>
  PUT(
    createRequest({
      email: "user@nyu.edu",
      selectedRooms: [{ roomId: 202, calendarId: "cal-room-202" }],
      allRooms: [],
      bookingCalendarInfo: {
        startStr: "2026-05-05T10:00:00.000Z",
        endStr: "2026-05-05T11:00:00.000Z",
      },
      data: { title: "Original Meeting", department: "ITP", ...data },
      calendarEventId: "old-cal-123",
      modifiedBy: "user@nyu.edu",
    }),
  );

const deletedServiceFlags = () =>
  mockServerDeleteFieldsByCalendarEventId.mock.calls
    .map(([, , fields]) => fields as string[])
    .filter((fields) => fields.some((f) => f.endsWith("ServiceApproved")));

const editEvents = () =>
  mockCallXStateTransitionAPI.mock.calls.filter(([, event]) => event === "edit");

describe("Edit resets only the service decisions of changed services", () => {
  beforeEach(() => {
    vi.clearAllMocks();

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
    mockCallXStateTransitionAPI.mockResolvedValue({
      success: true,
      newState: "Requested",
    });
  });

  describe("a declined booking with staff approved and catering declined", () => {
    beforeEach(() => {
      mockGetStatusFromXState.mockReturnValue("DECLINED");
      mockServerBookingContents.mockResolvedValue(
        savedBooking({
          declinedAt: { __mock: "declinedAt" },
          staffServiceApproved: true,
          cateringServiceApproved: false,
        }),
      );
    });

    it("clears only catering when only the catering chartfield changed", async () => {
      const res = await submit({
        ...savedServiceRequests,
        chartFieldForCateringByRoom: { "202": "CCCCC-DDDDD" },
      });
      expect(res.status).toBe(200);

      expect(deletedServiceFlags()).toEqual([["cateringServiceApproved"]]);
      expect(editEvents()).toEqual([
        ["new-cal-456", "edit", "user@nyu.edu", "mc", undefined, undefined, ["catering"]],
      ]);

      // Decisions never travel with the form answers.
      const updatedData = mockServerUpdateDataByCalendarEventId.mock.calls[0][2];
      expect(updatedData.calendarEventId).toBe("new-cal-456");
      expect(updatedData).not.toHaveProperty("staffServiceApproved");
      expect(updatedData).not.toHaveProperty("cateringServiceApproved");
    });

    it("keeps every decision when only Details changed, and still resubmits", async () => {
      const res = await submit({
        ...savedServiceRequests,
        title: "Renamed Meeting",
        expectedAttendance: "40",
      });
      expect(res.status).toBe(200);

      expect(deletedServiceFlags()).toEqual([]);
      expect(editEvents()).toEqual([
        ["new-cal-456", "edit", "user@nyu.edu", "mc", undefined, undefined, []],
      ]);
    });

    it("clears both decisions when both services changed", async () => {
      await submit({
        ...savedServiceRequests,
        staffingServices: "",
        cateringByRoom: { "202": "no" },
        catering: "no",
      });

      expect(deletedServiceFlags()).toEqual([
        ["staffServiceApproved", "cateringServiceApproved"],
      ]);
      expect(editEvents()[0][6]).toEqual(["staff", "catering"]);
    });

    it("does not clear a decision for a newly requested service that has none", async () => {
      await submit({
        ...savedServiceRequests,
        hireSecurity: "yes",
        hireSecurityByRoom: { "202": "yes" },
      });

      expect(deletedServiceFlags()).toEqual([]);
      expect(editEvents()[0][6]).toEqual(["security"]);
    });
  });

  describe("a requested booking", () => {
    beforeEach(() => {
      mockGetStatusFromXState.mockReturnValue("REQUESTED");
    });

    it("clears a retained decision whose service changed and reconciles the machine", async () => {
      // Decisions survive a Declined → edit → Requested cycle (ADR-0001).
      mockServerBookingContents.mockResolvedValue(
        savedBooking({ staffServiceApproved: true }),
      );

      const res = await submit({
        ...savedServiceRequests,
        staffingServices: "lighting_tech",
      });
      expect(res.status).toBe(200);

      expect(deletedServiceFlags()).toEqual([["staffServiceApproved"]]);
      expect(editEvents()).toEqual([
        ["new-cal-456", "edit", "user@nyu.edu", "mc", undefined, undefined, ["staff"]],
      ]);
    });

    it("leaves the machine alone when no decision had to be cleared", async () => {
      mockServerBookingContents.mockResolvedValue(savedBooking());

      const res = await submit({
        ...savedServiceRequests,
        chartFieldForCateringByRoom: { "202": "CCCCC-DDDDD" },
      });
      expect(res.status).toBe(200);

      expect(deletedServiceFlags()).toEqual([]);
      expect(editEvents()).toEqual([]);
    });
  });
});
