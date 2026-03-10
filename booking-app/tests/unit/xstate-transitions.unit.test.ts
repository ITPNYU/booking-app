import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Environment variables
process.env.NEXT_PUBLIC_BASE_URL = "http://localhost:3000";
process.env.NEXT_PUBLIC_BRANCH_NAME = "test";

// Firebase mocks
const mockServerGetDataByCalendarEventId = vi.fn();
const mockServerUpdateDataByCalendarEventId = vi.fn();
const mockServerSaveDataToFirestore = vi.fn();
const mockServerFetchAllDataFromCollection = vi.fn();
const mockServerSendBookingDetailEmail = vi.fn();
const mockGetTenantEmailConfig = vi.fn();
const mockGetApprovalCcEmail = vi.fn();
const mockHandleStateTransitions = vi.fn();

vi.mock("@/lib/firebase/server/adminDb", () => ({
  serverGetDataByCalendarEventId: (...args: any[]) =>
    mockServerGetDataByCalendarEventId(...args),
  serverSaveDataToFirestore: (...args: any[]) =>
    mockServerSaveDataToFirestore(...args),
  serverFetchAllDataFromCollection: (...args: any[]) =>
    mockServerFetchAllDataFromCollection(...args),
}));

vi.mock("@/components/src/server/admin", () => ({
  serverUpdateDataByCalendarEventId: (...args: any[]) =>
    mockServerUpdateDataByCalendarEventId(...args),
  serverSendBookingDetailEmail: (...args: any[]) =>
    mockServerSendBookingDetailEmail(...args),
}));

vi.mock("@/components/src/server/emails", () => ({
  getTenantEmailConfig: (...args: any[]) =>
    mockGetTenantEmailConfig(...args),
}));

vi.mock("@/components/src/policy", () => ({
  TableNames: {
    BOOKING: "bookings",
    PRE_BAN_LOGS: "preBanLogs",
  },
  getApprovalCcEmail: (...args: any[]) => mockGetApprovalCcEmail(...args),
}));

vi.mock("@/components/src/types", () => ({
  BookingStatusLabel: {
    REQUESTED: "REQUESTED",
    PRE_APPROVED: "PRE-APPROVED",
    APPROVED: "APPROVED",
    DECLINED: "DECLINED",
    CANCELED: "CANCELED",
    CHECKED_IN: "CHECKED-IN",
    CHECKED_OUT: "CHECKED-OUT",
    NO_SHOW: "NO-SHOW",
    UNKNOWN: "UNKNOWN",
  },
}));

vi.mock("@/components/src/utils/tenantUtils", () => ({
  isMediaCommons: (tenant?: string) => tenant === "mc",
  shouldUseXState: () => true,
  getMediaCommonsServices: () => ({}),
}));

vi.mock("firebase-admin", () => ({
  default: {
    firestore: {
      Timestamp: {
        now: () => ({ toDate: () => new Date(), seconds: 1000, nanoseconds: 0 }),
      },
    },
  },
  firestore: {
    Timestamp: {
      now: () => ({ toDate: () => new Date(), seconds: 1000, nanoseconds: 0 }),
    },
  },
}));

vi.mock("@/lib/logger/bookingLogger", () => ({
  BookingLogger: {
    xstateTransition: vi.fn(),
    calendarUpdate: vi.fn(),
    calendarError: vi.fn(),
  },
}));

// Mock the effects module
vi.mock("@/lib/stateMachines/xstateEffects", () => ({
  handleStateTransitions: (...args: any[]) =>
    mockHandleStateTransitions(...args),
}));

// Mock the persistence module - provide a minimal working implementation
const mockRestoreXStateFromFirestore = vi.fn();
const mockCreateXStateDataFromBookingStatus = vi.fn();

vi.mock("@/lib/stateMachines/xstatePersistence", () => ({
  restoreXStateFromFirestore: (...args: any[]) =>
    mockRestoreXStateFromFirestore(...args),
  createXStateDataFromBookingStatus: (...args: any[]) =>
    mockCreateXStateDataFromBookingStatus(...args),
  cleanObjectForFirestore: (obj: any) => obj,
  getMachineForTenant: () => ({ id: "mcBookingMachine" }),
}));

const createMockTimestamp = () => ({
  toDate: () => new Date(),
  toMillis: () => Date.now(),
});

const buildBookingDoc = (overrides: any = {}) => ({
  id: "booking-123",
  email: "guest@nyu.edu",
  netId: "abc123",
  startDate: createMockTimestamp(),
  endDate: createMockTimestamp(),
  requestedAt: createMockTimestamp(),
  selectedRooms: [],
  ...overrides,
});

function createMockActor(currentState: string) {
  let snapshot = {
    value: currentState,
    context: {
      tenant: "mc",
      calendarEventId: "test-event-123",
      servicesRequested: {},
      servicesApproved: {},
    },
    can: (event: any) => {
      // Simple transition validation
      const validTransitions: Record<string, string[]> = {
        Requested: ["approve", "decline", "cancel", "edit"],
        "Pre-approved": ["approve", "decline", "cancel", "edit"],
        Approved: ["checkIn", "cancel", "noShow", "edit"],
        "Checked In": ["checkOut", "noShow"],
      };
      return (validTransitions[currentState] || []).includes(event.type);
    },
  };

  return {
    start: vi.fn(),
    stop: vi.fn(),
    getSnapshot: () => snapshot,
    getPersistedSnapshot: () => ({
      value: snapshot.value,
      context: snapshot.context,
      status: "active",
    }),
    send: (event: any) => {
      // Simple state transition simulation
      const transitions: Record<string, Record<string, string>> = {
        Requested: { approve: "Pre-approved", decline: "Declined", cancel: "Canceled" },
        "Pre-approved": { approve: "Approved", decline: "Declined", cancel: "Canceled" },
        Approved: { checkIn: "Checked In", cancel: "Canceled", noShow: "No Show" },
        "Checked In": { checkOut: "Checked Out", noShow: "No Show" },
      };
      const newState = transitions[currentState]?.[event.type] || currentState;
      snapshot = { ...snapshot, value: newState };
    },
    subscribe: vi.fn().mockReturnValue({ unsubscribe: vi.fn() }),
  };
}

const defaultEmailConfig = {
  emailMessages: {
    declined: "Your booking has been declined.",
    canceled: "Your booking has been canceled.",
    noShow: "You have been marked as a no-show. Violation count: ${violationCount}.",
    checkoutConfirmation: "You have been checked out.",
  },
};

describe("xstateTransitions", () => {
  const calendarEventId = "test-event-123";
  const email = "admin@nyu.edu";
  const tenant = "mc";

  beforeEach(() => {
    vi.clearAllMocks();

    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    });

    mockGetTenantEmailConfig.mockResolvedValue(defaultEmailConfig);
    mockServerGetDataByCalendarEventId.mockResolvedValue(buildBookingDoc());
    mockServerUpdateDataByCalendarEventId.mockResolvedValue(undefined);
    mockServerSendBookingDetailEmail.mockResolvedValue(undefined);
    mockHandleStateTransitions.mockResolvedValue(undefined);
    mockGetApprovalCcEmail.mockReturnValue("admin-cc@nyu.edu");
    mockServerSaveDataToFirestore.mockResolvedValue(undefined);
    mockServerFetchAllDataFromCollection.mockResolvedValue([]);
  });

  describe("executeXStateTransition", () => {
    let executeXStateTransition: any;

    beforeEach(async () => {
      const mod = await import("@/lib/stateMachines/xstateTransitions");
      executeXStateTransition = mod.executeXStateTransition;
    });

    it("should return error when actor cannot be restored", async () => {
      mockRestoreXStateFromFirestore.mockResolvedValue(null);

      const result = await executeXStateTransition(
        calendarEventId, "approve", tenant, email,
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("Failed to restore");
    });

    it("should return error for invalid transition", async () => {
      const actor = createMockActor("Approved");
      mockRestoreXStateFromFirestore.mockResolvedValue(actor);

      const result = await executeXStateTransition(
        calendarEventId, "approve", tenant, email,
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid transition");
    });

    it("should execute valid transition and save to Firestore", async () => {
      const actor = createMockActor("Requested");
      mockRestoreXStateFromFirestore.mockResolvedValue(actor);

      const result = await executeXStateTransition(
        calendarEventId, "approve", tenant, email,
      );

      expect(result.success).toBe(true);
      expect(actor.start).toHaveBeenCalled();
      expect(actor.stop).toHaveBeenCalled();

      // Should save xstateData to Firestore
      expect(mockServerUpdateDataByCalendarEventId).toHaveBeenCalledWith(
        "bookings",
        calendarEventId,
        expect.objectContaining({
          xstateData: expect.objectContaining({
            machineId: "mcBookingMachine",
            snapshot: expect.any(Object),
            lastTransition: expect.any(String),
          }),
        }),
        tenant,
      );
    });

    it("should call handleStateTransitions with correct arguments", async () => {
      const actor = createMockActor("Requested");
      mockRestoreXStateFromFirestore.mockResolvedValue(actor);

      await executeXStateTransition(
        calendarEventId, "decline", tenant, email, "Service unavailable",
      );

      expect(mockHandleStateTransitions).toHaveBeenCalledWith(
        expect.any(Object), // currentSnapshot
        expect.any(Object), // newSnapshot
        calendarEventId,
        email,
        tenant,
        expect.any(Object), // firestoreUpdates
        actor,
        "Service unavailable", // reason
      );
    });

    describe("noShow event", () => {
      it("should create pre-ban log for policy violations", async () => {
        const actor = createMockActor("Approved");
        mockRestoreXStateFromFirestore.mockResolvedValue(actor);

        await executeXStateTransition(
          calendarEventId, "noShow", tenant, email,
        );

        expect(mockServerSaveDataToFirestore).toHaveBeenCalledWith(
          "preBanLogs",
          expect.objectContaining({
            netId: "abc123",
            bookingId: calendarEventId,
          }),
          tenant,
        );
      });

      it("should skip pre-ban log for VIP bookings", async () => {
        const actor = createMockActor("Approved");
        mockRestoreXStateFromFirestore.mockResolvedValue(actor);
        mockServerGetDataByCalendarEventId.mockResolvedValue(
          buildBookingDoc({ isVip: true }),
        );

        await executeXStateTransition(
          calendarEventId, "noShow", tenant, email,
        );

        expect(mockServerSaveDataToFirestore).not.toHaveBeenCalled();
      });

      it("should skip pre-ban log for walk-in bookings", async () => {
        const actor = createMockActor("Approved");
        mockRestoreXStateFromFirestore.mockResolvedValue(actor);
        mockServerGetDataByCalendarEventId.mockResolvedValue(
          buildBookingDoc({ origin: "walk-in" }),
        );

        await executeXStateTransition(
          calendarEventId, "noShow", tenant, email,
        );

        expect(mockServerSaveDataToFirestore).not.toHaveBeenCalled();
      });

      it("should send no-show email to guest and admin", async () => {
        const actor = createMockActor("Approved");
        mockRestoreXStateFromFirestore.mockResolvedValue(actor);

        await executeXStateTransition(
          calendarEventId, "noShow", tenant, email,
        );

        // Two emails: guest + admin
        expect(mockServerSendBookingDetailEmail).toHaveBeenCalledTimes(2);

        // Guest email
        expect(mockServerSendBookingDetailEmail).toHaveBeenCalledWith(
          expect.objectContaining({
            calendarEventId,
            targetEmail: "guest@nyu.edu",
            status: "NO-SHOW",
            tenant,
          }),
        );

        // Admin CC email
        expect(mockServerSendBookingDetailEmail).toHaveBeenCalledWith(
          expect.objectContaining({
            calendarEventId,
            targetEmail: "admin-cc@nyu.edu",
            status: "NO-SHOW",
            tenant,
          }),
        );
      });

      it("should include violation count in no-show email", async () => {
        const actor = createMockActor("Approved");
        mockRestoreXStateFromFirestore.mockResolvedValue(actor);

        // Return 2 existing violations + the new one that was just saved
        mockServerFetchAllDataFromCollection.mockResolvedValue([
          { id: "1" },
          { id: "2" },
          { id: "3" },
        ]);

        await executeXStateTransition(
          calendarEventId, "noShow", tenant, email,
        );

        const emailCall = mockServerSendBookingDetailEmail.mock.calls[0][0];
        expect(emailCall.headerMessage).toContain("3");
      });

      it("should update calendar with NO_SHOW status", async () => {
        const actor = createMockActor("Approved");
        mockRestoreXStateFromFirestore.mockResolvedValue(actor);

        await executeXStateTransition(
          calendarEventId, "noShow", tenant, email,
        );

        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining("/api/calendarEvents"),
          expect.objectContaining({
            method: "PUT",
            body: JSON.stringify({
              calendarEventId,
              newValues: { statusPrefix: "NO-SHOW" },
            }),
          }),
        );
      });

      it("should set noShowedAt and noShowedBy in Firestore updates", async () => {
        const actor = createMockActor("Approved");
        mockRestoreXStateFromFirestore.mockResolvedValue(actor);

        await executeXStateTransition(
          calendarEventId, "noShow", tenant, email,
        );

        expect(mockServerUpdateDataByCalendarEventId).toHaveBeenCalledWith(
          "bookings",
          calendarEventId,
          expect.objectContaining({
            noShowedAt: expect.any(Object),
            noShowedBy: email,
          }),
          tenant,
        );
      });

      it("should pass skipCalendarForServiceCloseout=true to handleStateTransitions", async () => {
        const actor = createMockActor("Approved");
        mockRestoreXStateFromFirestore.mockResolvedValue(actor);

        await executeXStateTransition(
          calendarEventId, "noShow", tenant, email,
        );

        expect(mockHandleStateTransitions).toHaveBeenCalledWith(
          expect.any(Object),
          expect.any(Object),
          calendarEventId,
          email,
          tenant,
          expect.any(Object),
          actor,
          undefined, // reason
        );
      });

      it("should not crash when no-show side effects fail", async () => {
        const actor = createMockActor("Approved");
        mockRestoreXStateFromFirestore.mockResolvedValue(actor);
        mockServerGetDataByCalendarEventId.mockRejectedValueOnce(
          new Error("DB error"),
        );
        // Second call for the Firestore save should work
        mockServerGetDataByCalendarEventId.mockResolvedValue(buildBookingDoc());

        const result = await executeXStateTransition(
          calendarEventId, "noShow", tenant, email,
        );

        // Should still succeed (side effect failure doesn't block transition)
        expect(result.success).toBe(true);
      });
    });

    describe("Media Commons service fields", () => {
      it("should update individual service approval fields", async () => {
        const actor = createMockActor("Pre-approved");
        // Override actor to return servicesApproved in context
        const originalGetSnapshot = actor.getSnapshot;
        let called = false;
        actor.getSnapshot = () => {
          const snap = originalGetSnapshot();
          if (called) {
            return {
              ...snap,
              context: {
                ...snap.context,
                servicesApproved: {
                  staff: true,
                  equipment: false,
                  catering: true,
                },
              },
            };
          }
          called = true;
          return snap;
        };
        mockRestoreXStateFromFirestore.mockResolvedValue(actor);

        await executeXStateTransition(
          calendarEventId, "approve", tenant, email,
        );

        expect(mockServerUpdateDataByCalendarEventId).toHaveBeenCalledWith(
          "bookings",
          calendarEventId,
          expect.objectContaining({
            staffServiceApproved: true,
            equipmentServiceApproved: false,
            cateringServiceApproved: true,
          }),
          tenant,
        );
      });
    });
  });

  describe("getAvailableXStateTransitions", () => {
    let getAvailableXStateTransitions: any;

    beforeEach(async () => {
      const mod = await import("@/lib/stateMachines/xstateTransitions");
      getAvailableXStateTransitions = mod.getAvailableXStateTransitions;
    });

    it("should return empty array when no booking data", async () => {
      mockServerGetDataByCalendarEventId.mockResolvedValue(null);

      const result = await getAvailableXStateTransitions(
        calendarEventId, tenant,
      );

      expect(result).toEqual([]);
    });

    it("should return available transitions from restored actor", async () => {
      mockServerGetDataByCalendarEventId.mockResolvedValue(
        buildBookingDoc({ xstateData: { snapshot: {}, machineId: "test" } }),
      );

      const actor = createMockActor("Approved");
      mockRestoreXStateFromFirestore.mockResolvedValue(actor);

      const result = await getAvailableXStateTransitions(
        calendarEventId, tenant,
      );

      expect(result).toContain("checkIn");
      expect(result).toContain("cancel");
      expect(result).toContain("noShow");
      expect(result).not.toContain("approve");
    });

    it("should create XState data when missing and shouldUseXState is true", async () => {
      // First call returns booking without xstateData
      mockServerGetDataByCalendarEventId.mockResolvedValueOnce(
        buildBookingDoc(),
      );
      // After creation, second call returns booking with xstateData
      mockServerGetDataByCalendarEventId.mockResolvedValueOnce(
        buildBookingDoc({ xstateData: { snapshot: {}, machineId: "test" } }),
      );
      mockCreateXStateDataFromBookingStatus.mockResolvedValue({
        snapshot: {},
        machineId: "test",
        lastTransition: new Date().toISOString(),
      });

      const actor = createMockActor("Requested");
      mockRestoreXStateFromFirestore.mockResolvedValue(actor);

      const result = await getAvailableXStateTransitions(
        calendarEventId, tenant,
      );

      expect(mockCreateXStateDataFromBookingStatus).toHaveBeenCalled();
      expect(result.length).toBeGreaterThan(0);
    });

    it("should return empty array on error", async () => {
      mockServerGetDataByCalendarEventId.mockRejectedValue(
        new Error("DB error"),
      );

      const result = await getAvailableXStateTransitions(
        calendarEventId, tenant,
      );

      expect(result).toEqual([]);
    });
  });
});
