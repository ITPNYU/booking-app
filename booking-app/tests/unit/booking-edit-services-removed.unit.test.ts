import { beforeEach, describe, expect, it, vi } from "vitest";

const mockServerBookingContents = vi.fn();
const mockServerUpdateDataByCalendarEventId = vi.fn();
const mockServerDeleteFieldsByCalendarEventId = vi.fn();
const mockServerSendBookingDetailEmail = vi.fn();
const mockServerApproveInstantBooking = vi.fn();
const mockFirstApproverEmails = vi.fn();
const mockInsertEvent = vi.fn();
const mockSendHTMLEmail = vi.fn();
const mockCallXStateTransitionAPI = vi.fn();
const mockCreateActor = vi.fn();
let mockMachineValue = "Requested";

vi.mock("@/components/src/server/admin", () => ({
  serverBookingContents: (...args: any[]) => mockServerBookingContents(...args),
  serverUpdateDataByCalendarEventId: (...args: any[]) =>
    mockServerUpdateDataByCalendarEventId(...args),
  serverDeleteFieldsByCalendarEventId: (...args: any[]) =>
    mockServerDeleteFieldsByCalendarEventId(...args),
  serverSendBookingDetailEmail: (...args: any[]) =>
    mockServerSendBookingDetailEmail(...args),
  serverApproveInstantBooking: (...args: any[]) =>
    mockServerApproveInstantBooking(...args),
  firstApproverEmails: (...args: any[]) => mockFirstApproverEmails(...args),
}));

vi.mock("@/components/src/server/calendars", () => ({
  deleteEvent: vi.fn().mockResolvedValue(undefined),
  insertEvent: (...args: any[]) => mockInsertEvent(...args),
  bookingContentsToDescription: vi.fn().mockResolvedValue("<p>desc</p>"),
}));

vi.mock("@/components/src/server/emails", () => ({
  getTenantEmailConfig: vi.fn().mockResolvedValue({
    schemaName: "Media Commons",
    emailNotifications: {
      requestedUser: "Thanks",
      requestedNeedsApproval: "Please review",
    },
  }),
}));

vi.mock("@/app/lib/sendHTMLEmail", () => ({
  sendHTMLEmail: (...args: any[]) => mockSendHTMLEmail(...args),
}));

vi.mock("@/lib/firebase/server/adminDb", () => ({
  logServerBookingChange: vi.fn().mockResolvedValue(undefined),
  serverGetDataByCalendarEventId: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/components/src/server/db", () => ({
  callXStateTransitionAPI: (...args: any[]) =>
    mockCallXStateTransitionAPI(...args),
}));

vi.mock("@/components/src/utils/statusFromXState", () => ({
  getStatusFromXState: () => "REQUESTED",
}));

vi.mock("@/lib/tenant/serverGetTenantResources", () => ({
  serverGetTenantResources: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/lib/stateMachines/mcBookingMachine", () => ({
  mcBookingMachine: { id: "MC Booking Request" },
}));

vi.mock("@/lib/stateMachines/itpBookingMachine", () => ({
  itpBookingMachine: { id: "ITP Booking Request" },
}));

vi.mock("xstate", () => ({
  createActor: (machine: any, options: any) => {
    mockCreateActor(machine, options);
    return {
      start: vi.fn(),
      stop: vi.fn(),
      getPersistedSnapshot: () => ({
        status: "active",
        value: mockMachineValue,
        context: options.input,
      }),
    };
  },
}));

vi.mock("@/app/api/bookings/route", () => ({
  createXStateData: (machineId: string, snapshot: any) => ({
    machineId,
    snapshot,
  }),
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
  getTenantRooms: vi
    .fn()
    .mockResolvedValue([{ roomId: 221, calendarId: "cal-room-221" }]),
}));

import { PUT } from "@/app/api/bookings/edit/route";
import { NextRequest } from "next/server";

const createRequest = (data: any) =>
  new NextRequest("http://localhost:3000/api/bookings/edit", {
    method: "PUT",
    headers: new Headers({ "Content-Type": "application/json" }),
    body: JSON.stringify({
      email: "user@nyu.edu",
      selectedRooms: [{ roomId: 221, calendarId: "cal-room-221" }],
      allRooms: [],
      bookingCalendarInfo: {
        startStr: "2026-05-05T10:00:00.000Z",
        endStr: "2026-05-05T10:30:00.000Z",
      },
      data: { title: "a", department: "ITP", role: "Student", ...data },
      calendarEventId: "old-cal-123",
      modifiedBy: "user@nyu.edu",
    }),
  });

describe("Edit that removes service requests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMachineValue = "Requested";

    mockServerBookingContents.mockResolvedValue({
      id: "booking-123",
      requestNumber: 3557,
      roomId: "221",
      title: "a",
      roomSetup: "yes",
      setupDetails: "test",
      chartFieldForRoomSetup: "test",
      origin: "user",
    });
    mockInsertEvent.mockResolvedValue({ id: "new-cal-456" });
    mockFirstApproverEmails.mockResolvedValue(["liaison@nyu.edu"]);
  });

  it("stops requesting services that were turned off and auto-approves", async () => {
    mockMachineValue = "Approved";

    const res = await PUT(
      createRequest({
        roomSetup: "no",
        setupDetails: "",
        chartFieldForRoomSetup: "",
      }),
    );
    expect(res.status).toBe(200);

    const { input } = mockCreateActor.mock.calls[0][1];
    expect(Object.values(input.servicesRequested).some(Boolean)).toBe(false);

    const updatedData = mockServerUpdateDataByCalendarEventId.mock.calls[0][2];
    expect(updatedData.xstateData.snapshot.value).toBe("Approved");
    expect(
      Object.values(
        updatedData.xstateData.snapshot.context.servicesRequested,
      ).some(Boolean),
    ).toBe(false);

    expect(mockServerApproveInstantBooking).toHaveBeenCalledWith(
      "new-cal-456",
      "user@nyu.edu",
      "mc",
    );
    expect(mockSendHTMLEmail).not.toHaveBeenCalled();
    expect(mockCallXStateTransitionAPI).not.toHaveBeenCalled();
  });

  it("keeps the booking Requested when a service is still requested", async () => {
    const res = await PUT(
      createRequest({ roomSetup: "yes", setupDetails: "10 chairs" }),
    );
    expect(res.status).toBe(200);

    const { input } = mockCreateActor.mock.calls[0][1];
    expect(input.servicesRequested.setup).toBe(true);

    const updatedData = mockServerUpdateDataByCalendarEventId.mock.calls[0][2];
    expect(updatedData.xstateData.snapshot.value).toBe("Requested");

    expect(mockServerApproveInstantBooking).not.toHaveBeenCalled();
    expect(mockSendHTMLEmail).toHaveBeenCalledWith(
      expect.objectContaining({ targetEmail: "liaison@nyu.edu" }),
    );
  });
});
