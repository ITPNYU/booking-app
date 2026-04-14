import { beforeEach, describe, expect, it, vi } from "vitest";

// -------------------------------------------------------------------------
// Shared test scaffolding
//
// These tests exercise `handleStateTransitions` directly (not via XState) to
// lock the side-effect behavior of each per-state handler in
// `booking-app/lib/stateMachines/effects/*`. A regression in any handler
// should make one of these tests fail loudly.
//
// Each test synthesizes a minimal `{ currentSnapshot, newSnapshot }` pair
// with only the fields the dispatcher and the targeted handler read, and
// asserts on:
//   - mutations to the `firestoreUpdates` object the dispatcher mutates
//   - calls to `global.fetch` (for calendar API PUTs)
//   - calls to the mocked `serverSendBookingDetailEmail` /
//     `serverUpdateDataByCalendarEventId` / `serverGetDocumentById` helpers
// -------------------------------------------------------------------------

process.env.NEXT_PUBLIC_BASE_URL = "http://localhost:3000";

const testCalendarEventId = "test-cal-event-xyz";
const testEmail = "actor@nyu.edu";
const testGuestEmail = "guest@nyu.edu";
const testTenant = "mc";

// --- Firebase admin mocks ------------------------------------------------

const mockServerGetDataByCalendarEventId = vi.fn();
const mockServerGetDocumentById = vi.fn();

vi.mock("@/lib/firebase/server/adminDb", () => ({
  serverGetDataByCalendarEventId: mockServerGetDataByCalendarEventId,
  serverGetDocumentById: mockServerGetDocumentById,
  logServerBookingChange: vi.fn(),
}));

// --- Server admin mocks --------------------------------------------------

const mockServerSendBookingDetailEmail = vi.fn();
const mockServerUpdateDataByCalendarEventId = vi.fn();

vi.mock("@/components/src/server/admin", () => ({
  serverSendBookingDetailEmail: mockServerSendBookingDetailEmail,
  serverUpdateDataByCalendarEventId: mockServerUpdateDataByCalendarEventId,
}));

// --- Email config mock ---------------------------------------------------

const mockGetTenantEmailConfig = vi.fn();

vi.mock("@/components/src/server/emails", () => ({
  getTenantEmailConfig: mockGetTenantEmailConfig,
}));

// --- Global fetch mock (calendar API) ------------------------------------

const mockFetch = vi.fn();
global.fetch = mockFetch as any;

// --- Helpers -------------------------------------------------------------

const buildBookingDoc = (overrides: Record<string, any> = {}) => ({
  id: "booking-123",
  requestNumber: 42,
  email: testGuestEmail,
  ...overrides,
});

const buildSnapshot = (
  value: string,
  context: Record<string, any> = {},
) => ({
  value,
  context,
  machine: { id: "MC Booking Request" },
});

const buildActor = (persistedValue: string = "Checked In") => ({
  getPersistedSnapshot: vi.fn(() => ({
    value: persistedValue,
    context: {},
    status: "active",
  })),
});

const callHandleStateTransitions = async (args: {
  previous: string;
  next: string;
  nextContext?: Record<string, any>;
  actor?: any;
  reason?: string;
}) => {
  const { handleStateTransitions } = await import(
    "@/lib/stateMachines/xstateEffects"
  );
  const firestoreUpdates: Record<string, any> = {};
  await handleStateTransitions(
    buildSnapshot(args.previous),
    buildSnapshot(args.next, args.nextContext || {}),
    testCalendarEventId,
    testEmail,
    testTenant,
    firestoreUpdates,
    args.actor ?? buildActor(),
    false,
    false,
    args.reason,
  );
  return firestoreUpdates;
};

const findCalendarPutCall = () =>
  mockFetch.mock.calls.find(([url, init]) => {
    return (
      typeof url === "string" &&
      url.includes("/api/calendarEvents") &&
      init?.method === "PUT"
    );
  });

// --- Default mock setup --------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();

  mockServerGetDataByCalendarEventId.mockResolvedValue(buildBookingDoc());
  mockServerGetDocumentById.mockResolvedValue(null);
  mockServerSendBookingDetailEmail.mockResolvedValue(undefined);
  mockServerUpdateDataByCalendarEventId.mockResolvedValue(undefined);
  mockGetTenantEmailConfig.mockResolvedValue({
    schemaName: "mc",
    emailMessages: {
      declined: "Your booking has been declined.",
      approvalNotice: "Approval notice.",
      checkoutConfirmation: "Checkout confirmation.",
      canceled: "Canceled.",
    },
  });
  mockFetch.mockResolvedValue({
    ok: true,
    status: 200,
    statusText: "OK",
    json: () => Promise.resolve({ success: true }),
    text: () => Promise.resolve("OK"),
  });
});

// -------------------------------------------------------------------------
// Tests
// -------------------------------------------------------------------------

describe("handleStateTransitions — per-state handler side effects", () => {
  describe("Approved", () => {
    it("stamps finalApprovedAt / finalApprovedBy and makes no outbound side effects", async () => {
      const firestoreUpdates = await callHandleStateTransitions({
        previous: "Pre-approved",
        next: "Approved",
      });

      expect(firestoreUpdates.finalApprovedAt).toBeDefined();
      expect(firestoreUpdates.finalApprovedBy).toBe(testEmail);

      // Approved handler intentionally delegates email/calendar/invite to
      // `/api/approve` → `finalApprove()`, so it should make zero outbound calls
      expect(mockFetch).not.toHaveBeenCalled();
      expect(mockServerSendBookingDetailEmail).not.toHaveBeenCalled();
      expect(mockServerUpdateDataByCalendarEventId).not.toHaveBeenCalled();
    });
  });

  describe("Canceled", () => {
    it("stamps canceledAt / canceledBy and makes no outbound side effects", async () => {
      const firestoreUpdates = await callHandleStateTransitions({
        previous: "Approved",
        next: "Canceled",
      });

      expect(firestoreUpdates.canceledAt).toBeDefined();
      expect(firestoreUpdates.canceledBy).toBe(testEmail);

      expect(mockFetch).not.toHaveBeenCalled();
      expect(mockServerSendBookingDetailEmail).not.toHaveBeenCalled();
      expect(mockServerUpdateDataByCalendarEventId).not.toHaveBeenCalled();
    });
  });

  describe("No Show", () => {
    it("stamps noShowedAt / noShowedBy and makes no outbound side effects", async () => {
      const firestoreUpdates = await callHandleStateTransitions({
        previous: "Approved",
        next: "No Show",
      });

      expect(firestoreUpdates.noShowedAt).toBeDefined();
      expect(firestoreUpdates.noShowedBy).toBe(testEmail);

      expect(mockFetch).not.toHaveBeenCalled();
      expect(mockServerSendBookingDetailEmail).not.toHaveBeenCalled();
      expect(mockServerUpdateDataByCalendarEventId).not.toHaveBeenCalled();
    });
  });

  describe("Pre-approved", () => {
    it("stamps firstApprovedAt / firstApprovedBy, pre-saves to Firestore, and updates calendar prefix", async () => {
      const firestoreUpdates = await callHandleStateTransitions({
        previous: "Requested",
        next: "Pre-approved",
      });

      // Firestore stamping
      expect(firestoreUpdates.firstApprovedAt).toBeDefined();
      expect(firestoreUpdates.firstApprovedBy).toBe(testEmail);

      // Pre-save write (dedicated Firestore update BEFORE calendar update)
      expect(mockServerUpdateDataByCalendarEventId).toHaveBeenCalledTimes(1);
      const [, calendarEventIdArg, preApprovalUpdateArg] =
        mockServerUpdateDataByCalendarEventId.mock.calls[0];
      expect(calendarEventIdArg).toBe(testCalendarEventId);
      expect(preApprovalUpdateArg.firstApprovedAt).toBeDefined();
      expect(preApprovalUpdateArg.firstApprovedBy).toBe(testEmail);

      // Calendar API called with PRE_APPROVED status prefix
      const calendarCall = findCalendarPutCall();
      expect(calendarCall).toBeDefined();
      const [, init] = calendarCall!;
      const body = JSON.parse((init as any).body);
      expect(body.calendarEventId).toBe(testCalendarEventId);
      expect(body.newValues.statusPrefix).toBe("PRE-APPROVED");
    });
  });

  describe("Checked In", () => {
    it("stamps checkedInAt / checkedInBy and persists XState snapshot to Firestore", async () => {
      const actor = buildActor("Checked In");
      const firestoreUpdates = await callHandleStateTransitions({
        previous: "Approved",
        next: "Checked In",
        actor,
      });

      expect(firestoreUpdates.checkedInAt).toBeDefined();
      expect(firestoreUpdates.checkedInBy).toBe(testEmail);

      // Actor.getPersistedSnapshot() called to build xstateData
      expect(actor.getPersistedSnapshot).toHaveBeenCalled();

      // Snapshot persisted via Firestore update with xstateData field
      expect(mockServerUpdateDataByCalendarEventId).toHaveBeenCalledTimes(1);
      const [, calendarEventIdArg, updateArg] =
        mockServerUpdateDataByCalendarEventId.mock.calls[0];
      expect(calendarEventIdArg).toBe(testCalendarEventId);
      expect(updateArg).toHaveProperty("xstateData");
      expect(updateArg.xstateData).toHaveProperty("snapshot");
      expect(updateArg.xstateData).toHaveProperty("machineId");
      expect(updateArg.xstateData).toHaveProperty("lastTransition");

      // No calendar API call (checkin-processing handles that separately)
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe("Declined", () => {
    it("stamps declinedAt / declinedBy, sends decline email with grace period + decline reason, and updates calendar prefix", async () => {
      // Tenant schema overrides the default 24h grace period to 48h
      mockServerGetDocumentById.mockResolvedValue({ declinedGracePeriod: 48 });

      const firestoreUpdates = await callHandleStateTransitions({
        previous: "Pre-approved",
        next: "Declined",
        nextContext: {
          declineReason: "Testing decline path",
        },
      });

      // Firestore stamping
      expect(firestoreUpdates.declinedAt).toBeDefined();
      expect(firestoreUpdates.declinedBy).toBe(testEmail);

      // Decline email sent with grace period + decline reason in header
      expect(mockServerSendBookingDetailEmail).toHaveBeenCalledTimes(1);
      const emailCall = mockServerSendBookingDetailEmail.mock.calls[0][0];
      expect(emailCall.calendarEventId).toBe(testCalendarEventId);
      expect(emailCall.targetEmail).toBe(testGuestEmail);
      expect(emailCall.status).toBe("DECLINED");
      expect(emailCall.headerMessage).toContain("Testing decline path");
      expect(emailCall.headerMessage).toContain("48 hours");

      // Calendar API called with DECLINED status prefix
      const calendarCall = findCalendarPutCall();
      expect(calendarCall).toBeDefined();
      const body = JSON.parse((calendarCall![1] as any).body);
      expect(body.newValues.statusPrefix).toBe("DECLINED");
    });

    it("composes per-service decline reason when servicesApproved contains declined entries", async () => {
      await callHandleStateTransitions({
        previous: "Services Request",
        next: "Declined",
        nextContext: {
          servicesRequested: {
            staff: true,
            catering: true,
            cleaning: false,
          },
          servicesApproved: {
            staff: false,
            catering: false,
            cleaning: false,
          },
        },
      });

      expect(mockServerSendBookingDetailEmail).toHaveBeenCalledTimes(1);
      const emailCall = mockServerSendBookingDetailEmail.mock.calls[0][0];

      // Only the requested + declined services should appear in the reason.
      // `cleaning` wasn't requested, so it's excluded.
      expect(emailCall.headerMessage).toContain("Staff");
      expect(emailCall.headerMessage).toContain("Catering");
      expect(emailCall.headerMessage).not.toContain("Cleaning");
      expect(emailCall.headerMessage).toContain("could not be fulfilled");
    });

    it("skips decline email when booking document has no email", async () => {
      mockServerGetDataByCalendarEventId.mockResolvedValue(
        buildBookingDoc({ email: undefined }),
      );

      await callHandleStateTransitions({
        previous: "Pre-approved",
        next: "Declined",
      });

      expect(mockServerSendBookingDetailEmail).not.toHaveBeenCalled();

      // Calendar update still runs even without guest email
      const calendarCall = findCalendarPutCall();
      expect(calendarCall).toBeDefined();
    });
  });

  describe("Dispatcher fall-through", () => {
    it("returns without side effects when newState has no registered handler (e.g. parallel state JSON)", async () => {
      // Simulate an XState parallel state value, which the dispatcher
      // normalizes to a JSON-stringified string before handler lookup.
      const parallelSnapshot = {
        value: { "Services Request": { "Staff Request": "Staff Requested" } },
        context: {},
        machine: { id: "MC Booking Request" },
      };

      const { handleStateTransitions } = await import(
        "@/lib/stateMachines/xstateEffects"
      );
      const firestoreUpdates: Record<string, any> = {};
      await handleStateTransitions(
        buildSnapshot("Requested"),
        parallelSnapshot,
        testCalendarEventId,
        testEmail,
        testTenant,
        firestoreUpdates,
        buildActor(),
        false,
        false,
        undefined,
      );

      // No handler matched → no firestoreUpdates mutations, no side effects
      expect(firestoreUpdates).toEqual({});
      expect(mockFetch).not.toHaveBeenCalled();
      expect(mockServerSendBookingDetailEmail).not.toHaveBeenCalled();
      expect(mockServerUpdateDataByCalendarEventId).not.toHaveBeenCalled();
    });
  });
});
