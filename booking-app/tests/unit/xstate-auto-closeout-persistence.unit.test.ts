import { beforeEach, describe, expect, it, vi } from "vitest";
import { createActor } from "xstate";

/**
 * Issue #1592: `servicesAutoCloseout` is derived from the tenant schema, not
 * stored with the booking. xstatePersistence must compute it when it first
 * builds a machine for a booking and recompute it on every restore, so a
 * schema edit applies to bookings persisted before it (and a removed flag
 * stops applying). These tests run the real restore against mocked Firestore
 * and schema reads, then drive a cancel through the real executor.
 */

const mockLogServerBookingChange = vi.fn();
const mockServerGetDataByCalendarEventId = vi.fn();
const mockServerUpdateDataByCalendarEventId = vi.fn();
const mockServerGetTenantResources = vi.fn();
const mockFetch = vi.fn();

vi.mock("@/lib/firebase/server/adminDb", () => ({
  logServerBookingChange: mockLogServerBookingChange,
  serverGetDataByCalendarEventId: mockServerGetDataByCalendarEventId,
  serverUpdateDataByCalendarEventId: mockServerUpdateDataByCalendarEventId,
  serverFetchAllDataFromCollection: vi.fn().mockResolvedValue([]),
  serverSaveDataToFirestore: vi.fn(),
  serverGetDocumentById: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/components/src/server/admin", () => ({
  serverUpdateDataByCalendarEventId: mockServerUpdateDataByCalendarEventId,
  serverSendBookingDetailEmail: vi.fn(),
  serverApproveEvent: vi.fn(),
  finalApprove: vi.fn(),
}));

vi.mock("@/components/src/server/emails", () => ({
  getTenantEmailConfig: vi.fn().mockResolvedValue({ emailNotifications: {} }),
}));

vi.mock("firebase-admin", () => ({
  firestore: { Timestamp: { now: () => ({ seconds: 0, nanoseconds: 0 }) } },
}));

vi.mock("@/lib/tenant/serverGetTenantResources", () => ({
  serverGetTenantResources: mockServerGetTenantResources,
}));

const ROOM_WITH_FLAG = {
  resourceId: "221",
  name: "Room 221",
  services: {
    staffing: {
      label: "Staffing",
      autoCloseout: true,
      sections: { default: { label: "Staffing", options: [] } },
    },
    equipment: { label: "Equipment" },
  },
};

const ROOM_WITHOUT_FLAG = {
  ...ROOM_WITH_FLAG,
  services: {
    staffing: {
      label: "Staffing",
      sections: { default: { label: "Staffing", options: [] } },
    },
    equipment: { label: "Equipment" },
  },
};

// An approved booking in room 221 with staffing + equipment requested and
// approved, as the booking document stores it.
const APPROVED_BOOKING = {
  id: "booking-1",
  requestNumber: 4242,
  email: "guest@nyu.edu",
  roomId: "221",
  staffingServices: "Need staff",
  equipmentServices: "Need cameras",
  staffServiceApproved: true,
  equipmentServiceApproved: true,
  requestedAt: { toDate: () => new Date("2026-10-01T00:00:00Z") },
  firstApprovedAt: { toDate: () => new Date("2026-10-02T00:00:00Z") },
  finalApprovedAt: { toDate: () => new Date("2026-10-03T00:00:00Z") },
  startDate: { toDate: () => new Date("2026-10-20T15:00:00Z") },
  endDate: { toDate: () => new Date("2026-10-20T16:00:00Z") },
};

/** The xstateData an earlier deploy persisted, with the flags it knew then. */
const persistedApproved = async (
  servicesAutoCloseout: Record<string, boolean>,
) => {
  const { mcBookingMachine } =
    await import("@/lib/stateMachines/mcBookingMachine");
  const actor = createActor(mcBookingMachine, {
    snapshot: mcBookingMachine.resolveState({
      value: "Approved",
      context: {
        tenant: "mc",
        calendarEventId: "cal-1",
        email: APPROVED_BOOKING.email,
        servicesRequested: { staff: true, equipment: true },
        servicesApproved: { staff: true, equipment: true },
        servicesAutoCloseout,
      },
    }),
  });
  return {
    machineId: mcBookingMachine.id,
    lastTransition: "2026-10-03T00:00:00.000Z",
    snapshot: JSON.parse(JSON.stringify(actor.getPersistedSnapshot())),
  };
};

const autoCloseoutNotes = () =>
  mockLogServerBookingChange.mock.calls
    .map(([arg]) => arg.note as string)
    .filter((note) => note.endsWith("(automatic)"));

describe("servicesAutoCloseout is derived from the schema on create and restore", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_BASE_URL = "http://localhost:3000";
    globalThis.fetch = mockFetch as unknown as typeof fetch;
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({}) });
    mockLogServerBookingChange.mockReset();
    mockLogServerBookingChange.mockResolvedValue(undefined);
    mockServerGetDataByCalendarEventId.mockReset();
    mockServerUpdateDataByCalendarEventId.mockReset();
    mockServerUpdateDataByCalendarEventId.mockResolvedValue(undefined);
    mockServerGetTenantResources.mockReset();
  });

  it("applies a flag added to the schema after the booking was persisted", async () => {
    mockServerGetDataByCalendarEventId.mockResolvedValue({
      ...APPROVED_BOOKING,
      xstateData: await persistedApproved({}),
    });
    mockServerGetTenantResources.mockResolvedValue([ROOM_WITH_FLAG]);

    const { executeXStateTransition } =
      await import("@/lib/stateMachines/xstateTransitions");
    const result = await executeXStateTransition(
      "cal-1",
      "cancel",
      "mc",
      "admin@nyu.edu",
    );

    expect(result.success).toBe(true);
    expect(result.newState).toMatchObject({
      "Service Closeout": {
        "Staff Closeout": "Staff Closedout",
        "Equipment Closeout": "Equipment Closeout Pending",
      },
    });
    expect(autoCloseoutNotes()).toEqual([
      "Staffing Service Closed Out (automatic)",
    ]);

    const [, , persisted] =
      mockServerUpdateDataByCalendarEventId.mock.calls.at(-1)!;
    expect(persisted.xstateData.snapshot.context.servicesAutoCloseout).toEqual({
      staff: true,
    });
  });

  it("stops applying a flag removed from the schema after the booking was persisted", async () => {
    mockServerGetDataByCalendarEventId.mockResolvedValue({
      ...APPROVED_BOOKING,
      xstateData: await persistedApproved({ staff: true }),
    });
    mockServerGetTenantResources.mockResolvedValue([ROOM_WITHOUT_FLAG]);

    const { executeXStateTransition } =
      await import("@/lib/stateMachines/xstateTransitions");
    const result = await executeXStateTransition(
      "cal-1",
      "cancel",
      "mc",
      "admin@nyu.edu",
    );

    expect(result.success).toBe(true);
    expect(result.newState).toMatchObject({
      "Service Closeout": {
        "Staff Closeout": "Staff Closeout Pending",
        "Equipment Closeout": "Equipment Closeout Pending",
      },
    });
    expect(mockLogServerBookingChange).not.toHaveBeenCalled();

    const [, , persisted] =
      mockServerUpdateDataByCalendarEventId.mock.calls.at(-1)!;
    expect(persisted.xstateData.snapshot.context.servicesAutoCloseout).toEqual(
      {},
    );
  });

  it("computes the flags from the booked rooms when building xstateData for a booking that has none", async () => {
    mockServerGetTenantResources.mockResolvedValue([ROOM_WITH_FLAG]);

    const { createXStateDataFromBookingStatus } =
      await import("@/lib/stateMachines/xstatePersistence");
    const xstateData = await createXStateDataFromBookingStatus(
      "cal-1",
      APPROVED_BOOKING,
      "mc",
    );

    expect(xstateData.snapshot.value).toBe("Approved");
    expect(xstateData.snapshot.context).toMatchObject({
      servicesRequested: { staff: true, equipment: true },
      servicesApproved: { staff: true, equipment: true },
      servicesAutoCloseout: { staff: true },
    });
  });

  it("reads the flag through getMediaCommonsAutoCloseout exactly as the schema stores it", async () => {
    // Guards against the persistence layer and the schema helper drifting
    // apart: the context key is the machine's service key ("staff"), the
    // schema key is "staffing".
    const { getMediaCommonsAutoCloseout } =
      await import("@/components/src/utils/tenantUtils");
    expect(
      getMediaCommonsAutoCloseout(APPROVED_BOOKING, [ROOM_WITH_FLAG]),
    ).toEqual({ staff: true });
    expect(
      getMediaCommonsAutoCloseout(APPROVED_BOOKING, [ROOM_WITHOUT_FLAG]),
    ).toEqual({});
  });
});
