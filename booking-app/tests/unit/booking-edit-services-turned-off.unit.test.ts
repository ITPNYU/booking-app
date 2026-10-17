import { beforeEach, describe, expect, it, vi } from "vitest";
import { createActor } from "xstate";

/**
 * A user edit that turns services off, run through the edit endpoint and the
 * real Media Commons machine (restore → "edit" → persist) against an
 * in-memory booking document.
 */

let booking: Record<string, any> | null = null;

const findBooking = (calendarEventId: string) =>
  booking?.calendarEventId === calendarEventId ? booking : null;

const setPath = (doc: Record<string, any>, path: string, value: unknown) => {
  const keys = path.split(".");
  let node = doc;
  for (const key of keys.slice(0, -1)) {
    node[key] = { ...(node[key] ?? {}) };
    node = node[key];
  }
  node[keys[keys.length - 1]] = value;
};

const mockFinalApprove = vi.fn();
const mockSendHTMLEmail = vi.fn();
const mockServerSendBookingDetailEmail = vi.fn();

vi.mock("@/components/src/server/admin", () => ({
  serverBookingContents: async (calendarEventId: string) => ({
    ...findBooking(calendarEventId),
  }),
  serverUpdateDataByCalendarEventId: async (
    _table: string,
    calendarEventId: string,
    data: Record<string, unknown>,
  ) => {
    const doc = findBooking(calendarEventId);
    if (!doc) throw new Error("Booking not found");
    for (const [key, value] of Object.entries(data)) {
      if (key.includes(".")) setPath(doc, key, value);
      else doc[key] = value;
    }
  },
  serverDeleteFieldsByCalendarEventId: async (
    _table: string,
    calendarEventId: string,
    fields: string[],
  ) => {
    const doc = findBooking(calendarEventId);
    for (const field of fields) delete doc?.[field];
  },
  serverSendBookingDetailEmail: (...args: any[]) =>
    mockServerSendBookingDetailEmail(...args),
  firstApproverEmails: async () => ["liaison@nyu.edu"],
  finalApprove: (...args: any[]) => mockFinalApprove(...args),
}));

vi.mock("@/lib/firebase/server/adminDb", () => ({
  logServerBookingChange: vi.fn(),
  serverGetDataByCalendarEventId: async (
    _table: string,
    calendarEventId: string,
  ) => findBooking(calendarEventId),
  // The edit route's ban check reads usersBanned through this helper.
  serverFetchAllDataFromCollection: async () => [],
}));

vi.mock("@/lib/bookingBan", () => ({
  BANNED_FROM_BOOKING_MESSAGE: "You are banned from booking",
  anyRequesterIsBanned: async () => false,
}));

vi.mock("@/components/src/server/db", () => ({
  // Runs the transition in-process instead of through /api/xstate-transition.
  callXStateTransitionAPI: async (
    calendarEventId: string,
    eventType: string,
    email: string,
    tenant: string,
    reason?: string,
    netId?: string,
    changedServices?: string[],
  ) => {
    const { executeXStateTransition } =
      await import("@/lib/stateMachines/xstateTransitions");
    return executeXStateTransition(
      calendarEventId,
      eventType,
      tenant,
      email,
      reason,
      netId,
      changedServices as any,
    );
  },
}));

vi.mock("@/components/src/server/calendars", () => ({
  deleteEvent: vi.fn(),
  insertEvent: async () => ({ id: "new-cal-456" }),
  bookingContentsToDescription: async () => "<p>desc</p>",
}));

vi.mock("@/components/src/server/emails", () => ({
  getTenantEmailConfig: async () => ({
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

vi.mock("@/lib/tenant/getCachedTenantSchema", () => ({
  getCachedTenantSchema: async () => ({}),
}));

vi.mock("@/lib/tenant/serverGetTenantResources", () => ({
  serverGetTenantResources: async () => [],
}));

vi.mock("@/app/api/bookings/shared", () => ({
  buildBookingContents: (...args: any[]) => args[0],
  extractTenantFromRequest: () => "mc",
  getTenantRooms: async () => [{ roomId: 202, calendarId: "cal-room-202" }],
}));

vi.mock("@/components/src/client/utils/serverDate", () => ({
  toFirebaseTimestampFromString: (s: string) => s,
}));

vi.mock("firebase-admin", () => ({
  firestore: { Timestamp: { now: () => "now" } },
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

import { PUT } from "@/app/api/bookings/edit/route";
import { mcBookingMachine } from "@/lib/stateMachines/mcBookingMachine";
import { NextRequest } from "next/server";

const ONE_HOUR = {
  startStr: "2026-05-05T10:00:00.000Z",
  endStr: "2026-05-05T11:00:00.000Z",
};
const FOUR_HOURS = {
  startStr: "2026-05-05T10:00:00.000Z",
  endStr: "2026-05-05T14:00:00.000Z",
};

const noServiceConditions = {
  setup: false,
  equipment: false,
  staffing: false,
  catering: false,
  cleaning: false,
  security: false,
};

/** Auto-approves service-less bookings of up to `maxHours`. */
const autoApprovingRoom = (maxHours = -1) => ({
  roomId: 202,
  calendarId: "cal-room-202",
  autoApproval: {
    minHour: { admin: -1, faculty: -1, student: -1 },
    maxHour: { admin: maxHours, faculty: maxHours, student: maxHours },
    conditions: noServiceConditions,
  },
});

const approvalOnlyRoom = () => ({
  roomId: 202,
  calendarId: "cal-room-202",
  autoApproval: { shouldAutoApprove: false },
});

/** Persisted snapshot of a booking created through the real machine. */
const persistedXState = (
  input: Record<string, unknown>,
  events: string[] = [],
) => {
  const actor = createActor(mcBookingMachine, {
    input: {
      tenant: "mc",
      calendarEventId: "old-cal-123",
      email: "user@nyu.edu",
      ...input,
    } as any,
  });
  actor.start();
  for (const type of events) actor.send({ type } as any);
  const snapshot = JSON.parse(JSON.stringify(actor.getPersistedSnapshot()));
  actor.stop();
  return { machineId: mcBookingMachine.id, snapshot };
};

const setupRequest = {
  roomSetup: "yes",
  setupDetails: "10 chairs in rows",
  chartFieldForRoomSetup: "AAAAA-BBBBB",
};
const setupTurnedOff = {
  roomSetup: "no",
  setupDetails: "",
  chartFieldForRoomSetup: "",
};

const saveBooking = (fields: Record<string, unknown>) => {
  booking = {
    id: "booking-123",
    calendarEventId: "old-cal-123",
    requestNumber: 3557,
    email: "user@nyu.edu",
    roomId: "202",
    title: "Thesis review",
    department: "ITP",
    origin: "user",
    ...fields,
  };
};

const submitEdit = async (
  data: Record<string, unknown>,
  {
    selectedRooms,
    bookingCalendarInfo = ONE_HOUR,
  }: { selectedRooms: unknown[]; bookingCalendarInfo?: object },
) => {
  const res = await PUT(
    new NextRequest("http://localhost:3000/api/bookings/edit", {
      method: "PUT",
      headers: new Headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        email: "user@nyu.edu",
        selectedRooms,
        allRooms: [],
        bookingCalendarInfo,
        data: { title: "Thesis review", department: "ITP", ...data },
        calendarEventId: "old-cal-123",
        modifiedBy: "user@nyu.edu",
      }),
    }),
  );
  expect(res.status).toBe(200);
  return res.json();
};

const machine = () => booking?.xstateData?.snapshot;

describe("Edit that turns service requests off (real machine)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    booking = null;
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({}),
    }) as any;
  });

  describe("a requested booking whose only service is room setup", () => {
    it("drops the service and auto-approves when the room allows it", async () => {
      saveBooking({
        ...setupRequest,
        xstateData: persistedXState({
          selectedRooms: [autoApprovingRoom()],
          bookingCalendarInfo: ONE_HOUR,
          servicesRequested: { setup: true },
        }),
      });
      expect(machine().value).toBe("Requested");

      const body = await submitEdit(setupTurnedOff, {
        selectedRooms: [autoApprovingRoom()],
      });

      expect(machine().value).toBe("Approved");
      expect(machine().context.servicesRequested.setup).toBe(false);
      expect(body.status).toBe("APPROVED");
      expect(mockFinalApprove).toHaveBeenCalledWith(
        "new-cal-456",
        "System",
        "mc",
      );
      expect(mockSendHTMLEmail).not.toHaveBeenCalled();
    });

    it("drops the service but stays Requested when the room needs approval", async () => {
      saveBooking({
        ...setupRequest,
        xstateData: persistedXState({
          selectedRooms: [approvalOnlyRoom()],
          bookingCalendarInfo: ONE_HOUR,
          servicesRequested: { setup: true },
        }),
      });

      const body = await submitEdit(setupTurnedOff, {
        selectedRooms: [approvalOnlyRoom()],
      });

      expect(machine().value).toBe("Requested");
      expect(machine().context.servicesRequested.setup).toBe(false);
      expect(body.status).toBe("REQUESTED");
      expect(mockFinalApprove).not.toHaveBeenCalled();
      expect(mockSendHTMLEmail).toHaveBeenCalledWith(
        expect.objectContaining({ targetEmail: "liaison@nyu.edu" }),
      );
    });

    it("judges auto-approval on the edited times, not the original ones", async () => {
      saveBooking({
        ...setupRequest,
        xstateData: persistedXState({
          selectedRooms: [autoApprovingRoom(2)],
          bookingCalendarInfo: ONE_HOUR,
          servicesRequested: { setup: true },
        }),
      });

      // Four hours is over the room's two-hour auto-approval limit.
      await submitEdit(setupTurnedOff, {
        selectedRooms: [autoApprovingRoom(2)],
        bookingCalendarInfo: FOUR_HOURS,
      });

      expect(machine().value).toBe("Requested");
      expect(machine().context.bookingCalendarInfo).toEqual(FOUR_HOURS);
      expect(mockFinalApprove).not.toHaveBeenCalled();
    });

    it("leaves the machine alone when the setup request only changed its details", async () => {
      const xstateData = persistedXState({
        selectedRooms: [autoApprovingRoom()],
        bookingCalendarInfo: ONE_HOUR,
        servicesRequested: { setup: true },
      });
      saveBooking({ ...setupRequest, xstateData });

      await submitEdit(
        { ...setupRequest, setupDetails: "12 chairs in a circle" },
        { selectedRooms: [autoApprovingRoom()] },
      );

      expect(booking?.xstateData).toEqual(xstateData);
      expect(mockFinalApprove).not.toHaveBeenCalled();
    });
  });

  describe("a declined booking whose catering request was declined", () => {
    const declinedWithCatering = (isVip: boolean) => {
      saveBooking({
        origin: isVip ? "vip" : "user",
        catering: "yes",
        cateringServiceApproved: false,
        declinedAt: "declined",
        xstateData: persistedXState(
          {
            selectedRooms: [approvalOnlyRoom()],
            bookingCalendarInfo: ONE_HOUR,
            servicesRequested: { catering: true },
            isVip,
            origin: isVip ? "vip" : "user",
          },
          // VIP bookings with services start in Services Request.
          isVip
            ? ["declineCatering"]
            : ["approve", "approve", "declineCatering"],
        ),
      });
      expect(machine().value).toBe("Declined");
    };

    it("keeps a VIP booking's auto-approval bypass after the edit", async () => {
      declinedWithCatering(true);

      await submitEdit(
        { catering: "no" },
        { selectedRooms: [approvalOnlyRoom()] },
      );

      expect(machine().context.isVip).toBe(true);
      expect(machine().context.servicesRequested.catering).toBe(false);
      expect(machine().value).toBe("Approved");
      expect(mockFinalApprove).toHaveBeenCalledWith(
        "new-cal-456",
        "System",
        "mc",
      );
    });

    it("sends a non-VIP booking in the same room back for approval", async () => {
      declinedWithCatering(false);

      await submitEdit(
        { catering: "no" },
        { selectedRooms: [approvalOnlyRoom()] },
      );

      expect(machine().context.isVip).toBe(false);
      expect(machine().value).toBe("Requested");
      expect(mockFinalApprove).not.toHaveBeenCalled();
    });
  });
});
