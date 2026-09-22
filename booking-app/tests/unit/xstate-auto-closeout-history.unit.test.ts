import { beforeEach, describe, expect, it, vi } from "vitest";
import { createActor } from "xstate";

/**
 * Issue #1592: when the machine closes a service out on its own (booked room
 * has `autoCloseout: true`), the xstate-transition executor drains the
 * queued `autoCloseout:<service>` effect into a booking-history row and
 * clears the queue before persisting the snapshot.
 */

const mockLogServerBookingChange = vi.fn();
const mockServerGetDataByCalendarEventId = vi.fn();
const mockServerUpdateDataByCalendarEventId = vi.fn();
const mockRestoreXStateFromFirestore = vi.fn();
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

vi.mock("@/lib/stateMachines/xstatePersistence", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/stateMachines/xstatePersistence")
  >("@/lib/stateMachines/xstatePersistence");
  return {
    ...actual,
    restoreXStateFromFirestore: mockRestoreXStateFromFirestore,
  };
});

const BOOKING = {
  id: "booking-1",
  requestNumber: 4242,
  email: "guest@nyu.edu",
  roomId: "221",
  staffServiceApproved: true,
  equipmentServiceApproved: true,
};

const approvedActor = async (servicesAutoCloseout: Record<string, boolean>) => {
  const { mcBookingMachine } =
    await import("@/lib/stateMachines/mcBookingMachine");
  return createActor(mcBookingMachine, {
    snapshot: mcBookingMachine.resolveState({
      value: "Approved",
      context: {
        tenant: "mc",
        calendarEventId: "cal-1",
        email: BOOKING.email,
        servicesRequested: { staff: true, equipment: true },
        servicesApproved: { staff: true, equipment: true },
        servicesAutoCloseout,
      },
    }),
  });
};

describe("auto closeout history side effect", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_BASE_URL = "http://localhost:3000";
    globalThis.fetch = mockFetch as unknown as typeof fetch;
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({}) });
    mockLogServerBookingChange.mockReset();
    mockLogServerBookingChange.mockResolvedValue(undefined);
    mockServerGetDataByCalendarEventId.mockReset();
    mockServerGetDataByCalendarEventId.mockResolvedValue(BOOKING);
    mockServerUpdateDataByCalendarEventId.mockReset();
    mockServerUpdateDataByCalendarEventId.mockResolvedValue(undefined);
    mockRestoreXStateFromFirestore.mockReset();
  });

  it("writes a System history row for the auto closed-out service and keeps the manual one pending", async () => {
    mockRestoreXStateFromFirestore.mockResolvedValue(
      await approvedActor({ staff: true }),
    );
    const { executeXStateTransition } =
      await import("@/lib/stateMachines/xstateTransitions");

    const result = await executeXStateTransition(
      "cal-1",
      "cancel",
      "mc",
      "admin@nyu.edu",
      undefined,
      "admin",
    );

    expect(result.success).toBe(true);
    expect(result.newState).toMatchObject({
      "Service Closeout": {
        "Staff Closeout": "Staff Closedout",
        "Equipment Closeout": "Equipment Closeout Pending",
      },
    });

    expect(mockLogServerBookingChange).toHaveBeenCalledTimes(1);
    expect(mockLogServerBookingChange).toHaveBeenCalledWith({
      bookingId: BOOKING.id,
      calendarEventId: "cal-1",
      status: "CHECKED-OUT",
      changedBy: "System",
      requestNumber: BOOKING.requestNumber,
      note: "Staffing Service Closed Out (automatic)",
      tenant: "mc",
    });

    // The cancel-processing effect queued by the Canceled entry runs first,
    // so the CANCELED history row lands before the closeout row.
    const cancelCallOrder =
      mockFetch.mock.invocationCallOrder[
        mockFetch.mock.calls.findIndex(([url]) =>
          String(url).includes("/api/cancel-processing"),
        )
      ];
    expect(cancelCallOrder).toBeLessThan(
      mockLogServerBookingChange.mock.invocationCallOrder[0],
    );

    const [, , persisted] =
      mockServerUpdateDataByCalendarEventId.mock.calls.at(-1)!;
    expect(persisted.xstateData.snapshot.context.pendingSideEffects).toEqual(
      [],
    );
  });

  it("reaches Closed in one transition when every approved service is flagged", async () => {
    mockRestoreXStateFromFirestore.mockResolvedValue(
      await approvedActor({ staff: true, equipment: true }),
    );
    const { executeXStateTransition } =
      await import("@/lib/stateMachines/xstateTransitions");

    const result = await executeXStateTransition(
      "cal-1",
      "cancel",
      "mc",
      "admin@nyu.edu",
    );

    expect(result).toEqual({ success: true, newState: "Closed" });
    expect(
      mockLogServerBookingChange.mock.calls.map(([arg]) => arg.note),
    ).toEqual([
      "Staffing Service Closed Out (automatic)",
      "Equipment Service Closed Out (automatic)",
    ]);
  });

  it("writes no closeout row when no service is flagged", async () => {
    mockRestoreXStateFromFirestore.mockResolvedValue(await approvedActor({}));
    const { executeXStateTransition } =
      await import("@/lib/stateMachines/xstateTransitions");

    const result = await executeXStateTransition(
      "cal-1",
      "cancel",
      "mc",
      "admin@nyu.edu",
    );

    expect(result.success).toBe(true);
    expect(mockLogServerBookingChange).not.toHaveBeenCalled();
  });
});
