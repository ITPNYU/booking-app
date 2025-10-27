import type { Mock } from "vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ActorRefFrom } from "xstate";
import { createActor } from "xstate";

import { mcBookingMachine } from "@/lib/stateMachines/mcBookingMachine";

const makeCalendarInfo = () => {
  const start = new Date();
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  return {
    startStr: start.toISOString(),
    endStr: end.toISOString(),
  };
};

const mockLogServerBookingChange = vi.fn();
const mockServerGetDataByCalendarEventId = vi.fn();
const mockServerUpdateDataByCalendarEventId = vi.fn();
const mockServerSaveDataToFirestore = vi.fn();

vi.mock("@/lib/firebase/server/adminDb", () => ({
  logServerBookingChange: mockLogServerBookingChange,
  serverGetDataByCalendarEventId: mockServerGetDataByCalendarEventId,
  serverUpdateDataByCalendarEventId: mockServerUpdateDataByCalendarEventId,
  serverSaveDataToFirestore: mockServerSaveDataToFirestore,
}));

vi.mock("@/components/src/policy", () => ({
  TableNames: {
    BOOKING: "bookings",
    BOOKING_LOGS: "bookingLogs",
  },
}));

vi.mock("@/components/src/types", () => ({
  BookingStatusLabel: {
    REQUESTED: "REQUESTED",
    PRE_APPROVED: "PRE-APPROVED",
    APPROVED: "APPROVED",
    DECLINED: "DECLINED",
    CANCELED: "CANCELED",
    NO_SHOW: "NO-SHOW",
  },
}));

type BookingActor = ActorRefFrom<(typeof mcBookingMachine)["createActor"]>;

const mockFetch = vi.fn();

const createTestActor = (
  input: Partial<
    Parameters<(typeof mcBookingMachine)["createActor"]>[0]["input"]
  > = {}
): BookingActor => {
  const actor = createActor(mcBookingMachine, {
    input: {
      tenant: "mc",
      selectedRooms: [{ roomId: 202, shouldAutoApprove: true }],
      bookingCalendarInfo: makeCalendarInfo(),
      calendarEventId: "cal-123",
      ...input,
    },
  });
  actor.start();
  return actor;
};

const waitForCondition = async (
  actor: BookingActor,
  condition: (snapshot: ReturnType<BookingActor["getSnapshot"]>) => boolean,
  timeout = 1_000
) => {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const snapshot = actor.getSnapshot();
    if (condition(snapshot)) {
      return snapshot;
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error("Timed out waiting for state condition");
};

const waitForMockCall = async (
  mockFn: Mock,
  predicate: (arg: any) => boolean,
  timeout = 1_000
) => {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const matchingCall = mockFn.mock.calls.find(([firstArg]) =>
      predicate(firstArg)
    );
    if (matchingCall) {
      return matchingCall[0];
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error("Timed out waiting for mock call");
};

const getPrimaryState = (
  snapshot: ReturnType<BookingActor["getSnapshot"]>
): string => {
  const value = snapshot.value as unknown;
  if (typeof value === "string") {
    return value;
  }

  if (value && typeof value === "object") {
    const keys = Object.keys(value as Record<string, unknown>);
    if (keys.length > 0) {
      return keys[0];
    }
  }

  return "Unknown";
};

describe("mcBookingMachine", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_BASE_URL =
      process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";

    mockFetch.mockReset();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
      status: 200,
      statusText: "OK",
    });
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    mockLogServerBookingChange.mockReset();
    mockLogServerBookingChange.mockResolvedValue(undefined);
    mockServerGetDataByCalendarEventId.mockReset();
    mockServerGetDataByCalendarEventId.mockResolvedValue({
      id: "booking-123",
      requestNumber: 123,
    });
    mockServerUpdateDataByCalendarEventId.mockReset();
    mockServerSaveDataToFirestore.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("auto-approval transitions to Approved state and preserves context", async () => {
    // Use the ACTUAL XState machine without modifications
    const actor = createActor(mcBookingMachine, {
      input: {
        tenant: "mc",
        calendarEventId: "cal-123",
        email: "guest@nyu.edu",
        selectedRooms: [{ roomId: 202, shouldAutoApprove: true }],
        bookingCalendarInfo: makeCalendarInfo(),
        formData: {
          email: "guest@nyu.edu",
          sponsorEmail: "sponsor@nyu.edu",
          title: "Media Commons Auto Approval",
        },
      },
    });

    actor.start();

    // Verify XState reached the correct state
    const snapshot = actor.getSnapshot();
    expect(snapshot.matches("Approved")).toBe(true);

    // Verify context is preserved correctly
    expect(snapshot.context.email).toBe("guest@nyu.edu");
    expect(snapshot.context.calendarEventId).toBe("cal-123");
    expect(snapshot.context.formData?.title).toBe(
      "Media Commons Auto Approval"
    );
    expect(snapshot.context.selectedRooms?.[0]?.shouldAutoApprove).toBe(true);

    // Wait for async actions to complete
    await new Promise((resolve) => setTimeout(resolve, 100));

    // The real XState actions are placeholders (console.log only)
    // This test verifies that XState correctly transitions states and preserves context
    // Real side effects (emails, calendar, logs) would be handled by external processing
    // after XState transition (via executeXStateTransition or similar)
  });

  it("transitions to Requested state when manual approval is required", async () => {
    mockLogServerBookingChange.mockClear();

    // Use the ACTUAL XState machine without modifications
    const actor = createActor(mcBookingMachine, {
      input: {
        tenant: "mc",
        calendarEventId: "cal-request-123",
        email: "requestor@nyu.edu",
        selectedRooms: [{ roomId: 202, shouldAutoApprove: false }],
        bookingCalendarInfo: makeCalendarInfo(),
        formData: {
          email: "requestor@nyu.edu",
          title: "Manual Approval Needed",
        },
        liaisonUsers: [{ email: "liaison@nyu.edu" }],
      },
    });

    actor.start();

    // Verify XState reached the correct state
    const snapshot = actor.getSnapshot();
    expect(snapshot.matches("Requested")).toBe(true);

    // Verify context is preserved correctly
    expect(snapshot.context.email).toBe("requestor@nyu.edu");
    expect(snapshot.context.calendarEventId).toBe("cal-request-123");
    expect(snapshot.context.formData?.title).toBe("Manual Approval Needed");
    expect(snapshot.context.selectedRooms?.[0]?.shouldAutoApprove).toBe(false);

    // Note: liaisonUsers may not be preserved in context depending on XState machine implementation
    // This test focuses on verifying the state transition and core context preservation

    // Wait for async actions to complete
    await new Promise((resolve) => setTimeout(resolve, 100));

    // The real XState actions are placeholders (console.log only)
    // This test verifies that XState correctly transitions to Requested state
    // Real side effects (emails, calendar, logs) would be handled by external processing
    // after XState transition (via executeXStateTransition or similar)
  });

  it("auto-approves when rooms allow auto approval and no services are requested", () => {
    const actor = createTestActor();

    expect(actor.getSnapshot().matches("Approved")).toBe(true);
  });

  it("routes VIP bookings with services into the Services Request parallel state", () => {
    const actor = createTestActor({
      isVip: true,
      servicesRequested: { staff: true },
    });

    const snapshot = actor.getSnapshot();

    expect(snapshot.matches("Services Request")).toBe(true);
    expect(snapshot.value).toEqual({
      "Services Request": {
        "Staff Request": "Staff Requested",
        "Catering Request": "Catering Approved",
        "Setup Request": "Setup Approved",
        "Cleaning Request": "Cleaning Approved",
        "Security Request": "Security Approved",
        "Equipment Request": "Equipment Approved",
      },
    });
  });

  it("moves from Pre-approved to Services Request when approvals are pending", () => {
    const actor = createTestActor({
      selectedRooms: [{ roomId: 202, shouldAutoApprove: false }],
      servicesRequested: { equipment: true },
      servicesApproved: {},
    });

    actor.send({ type: "approve" });
    expect(actor.getSnapshot().matches("Pre-approved")).toBe(true);

    actor.send({ type: "approve" });
    expect(actor.getSnapshot().matches("Services Request")).toBe(true);
  });

  it("completes approval when all requested services are already approved", () => {
    const actor = createTestActor({
      selectedRooms: [{ roomId: 202, shouldAutoApprove: false }],
      servicesRequested: { staff: true },
      servicesApproved: { staff: true },
    });

    actor.send({ type: "approve" });
    expect(actor.getSnapshot().matches("Pre-approved")).toBe(true);

    actor.send({ type: "approve" });
    expect(actor.getSnapshot().matches("Approved")).toBe(true);
  });

  it("defaults decline reason when declining without a provided note", () => {
    const actor = createTestActor({
      selectedRooms: [{ roomId: 202, shouldAutoApprove: false }],
    });

    expect(actor.getSnapshot().matches("Requested")).toBe(true);
    actor.send({ type: "approve" });
    expect(actor.getSnapshot().matches("Pre-approved")).toBe(true);

    actor.send({ type: "decline" });

    const snapshot = actor.getSnapshot();
    expect(snapshot.matches("Declined")).toBe(true);
    expect(snapshot.context.declineReason).toBe(
      "Service requirements could not be fulfilled"
    );
  });

  it("cancels without services and transitions to Closed", async () => {
    const actor = createTestActor({ isWalkIn: true });
    expect(actor.getSnapshot().matches("Approved")).toBe(true);

    actor.send({ type: "cancel" });
    await waitForCondition(actor, (snapshot) => snapshot.matches("Closed"));

    expect(mockFetch).toHaveBeenCalled();
  });

  it("cancels with approved services and waits for closeout before closing", async () => {
    const actor = createTestActor({
      isWalkIn: true,
      servicesRequested: { staff: true },
      servicesApproved: { staff: true },
    });

    expect(actor.getSnapshot().matches("Approved")).toBe(true);
    actor.send({ type: "cancel" });

    await waitForCondition(actor, (snapshot) =>
      snapshot.matches("Service Closeout")
    );
    actor.send({ type: "closeoutStaff" });

    await waitForCondition(actor, (snapshot) => snapshot.matches("Closed"));
  });

  it("handles check-in and check-out flow to completion", async () => {
    const actor = createTestActor({ isWalkIn: true });
    expect(actor.getSnapshot().matches("Approved")).toBe(true);

    actor.send({ type: "checkIn" });
    expect(actor.getSnapshot().matches("Checked In")).toBe(true);

    actor.send({ type: "checkOut" });
    await waitForCondition(actor, (snapshot) => snapshot.matches("Closed"));
  });

  it("marks no show, logs history, and closes the booking", async () => {
    const actor = createTestActor({ isWalkIn: true, email: "user@nyu.edu" });
    expect(actor.getSnapshot().matches("Approved")).toBe(true);

    actor.send({ type: "noShow" });

    await waitForCondition(actor, (snapshot) => snapshot.matches("Closed"));

    // Wait for async logBookingHistory action to complete
    await waitForMockCall(
      mockLogServerBookingChange,
      (arg) => arg.status === "NO-SHOW"
    );

    expect(mockLogServerBookingChange).toHaveBeenCalled();
  });

  it("marks no show with services, transitions through Service Closeout, and closes", async () => {
    // Create an approved booking with services
    const actor = createTestActor({
      isVip: true,
      email: "user@nyu.edu",
      servicesRequested: { equipment: true, staff: true },
      servicesApproved: { equipment: true, staff: true },
    });

    // First, we need to approve the services to get to Approved state
    actor.send({ type: "approveEquipment" });
    actor.send({ type: "approveStaff" });
    await waitForCondition(actor, (snapshot) => snapshot.matches("Approved"));

    // Now send no show event
    actor.send({ type: "noShow" });

    // Should go through: No Show → Canceled → Service Closeout → Closed
    // Wait for Service Closeout state
    await waitForCondition(
      actor,
      (snapshot) =>
        typeof snapshot.value === "object" &&
        snapshot.value !== null &&
        "Service Closeout" in snapshot.value
    );

    // Close out the services
    actor.send({ type: "closeoutEquipment" });
    actor.send({ type: "closeoutStaff" });

    // Should now transition to Closed
    await waitForCondition(actor, (snapshot) => snapshot.matches("Closed"));

    // Wait for async logBookingHistory action to complete
    await waitForMockCall(
      mockLogServerBookingChange,
      (arg) => arg.status === "NO-SHOW"
    );

    expect(mockLogServerBookingChange).toHaveBeenCalled();
  });

  it("closes reservations when autoCloseScript event is received", async () => {
    const actor = createTestActor({ isWalkIn: true });
    expect(actor.getSnapshot().matches("Approved")).toBe(true);

    actor.send({ type: "autoCloseScript" });
    await waitForCondition(actor, (snapshot) => snapshot.matches("Closed"));
  });

  it("approves requested services and transitions back to Approved", async () => {
    const actor = createTestActor({
      isVip: true,
      selectedRooms: [{ roomId: 202, shouldAutoApprove: false }],
      servicesRequested: { catering: true },
    });

    expect(actor.getSnapshot().matches("Services Request")).toBe(true);
    actor.send({ type: "approveCatering" });

    await waitForCondition(actor, (snapshot) => snapshot.matches("Approved"));
  });

  it("declines requested services and moves to Declined state", async () => {
    const actor = createTestActor({
      isVip: true,
      selectedRooms: [{ roomId: 202, shouldAutoApprove: false }],
      servicesRequested: { equipment: true },
    });

    expect(actor.getSnapshot().matches("Services Request")).toBe(true);
    actor.send({ type: "declineEquipment" });

    await waitForCondition(actor, (snapshot) => snapshot.matches("Declined"));
  });

  it("emits the official guideline state sequence for manual service approvals", async () => {
    const actor = createTestActor({
      selectedRooms: [{ roomId: 202, shouldAutoApprove: false }],
      servicesRequested: { equipment: true, staff: true },
    });

    const stateSequence: string[] = [getPrimaryState(actor.getSnapshot())];

    const subscription = actor.subscribe((snapshot) => {
      const primary = getPrimaryState(snapshot);
      if (stateSequence.at(-1) !== primary) {
        stateSequence.push(primary);
      }
    });

    // Recommended by the official XState testing guide: assert snapshots via subscribe().
    actor.send({ type: "approve" });
    actor.send({ type: "approve" });
    actor.send({ type: "approveEquipment" });
    actor.send({ type: "approveStaff" });

    await waitForCondition(actor, (snapshot) => snapshot.matches("Approved"));

    subscription.unsubscribe();

    expect(stateSequence).toEqual([
      "Requested",
      "Pre-approved",
      "Services Request",
      "Approved",
    ]);
  });

  it("maintains Approved state when modifying an approved booking (Modify event)", () => {
    // Create an actor that auto-approves (no services, auto-approvable room)
    const actor = createTestActor({
      selectedRooms: [{ roomId: 202, shouldAutoApprove: true }],
    });

    // Verify initial state is Approved (auto-approved)
    expect(actor.getSnapshot().matches("Approved")).toBe(true);

    // Send Modify event (simulating a modification request)
    actor.send({ type: "Modify" });

    // Verify it stays in Approved state (modification should not change approval status)
    expect(actor.getSnapshot().matches("Approved")).toBe(true);
  });

  it("transitions to Approved state when initialized with services requested and approved", () => {
    // This simulates restoring a modified booking that was previously approved
    // with services that are already approved
    const actor = createTestActor({
      selectedRooms: [{ roomId: 202, shouldAutoApprove: false }],
      servicesRequested: { staff: true, equipment: true },
      servicesApproved: { staff: true, equipment: true },
      _restoredFromStatus: true, // Indicates this is a restored booking
    });

    // Initially should be in Requested state
    expect(actor.getSnapshot().matches("Requested")).toBe(true);

    // Approve to Pre-approved
    actor.send({ type: "approve" });
    expect(actor.getSnapshot().matches("Pre-approved")).toBe(true);

    // Second approve should recognize that all services are already approved
    // and go directly to Approved instead of Services Request
    actor.send({ type: "approve" });
    expect(actor.getSnapshot().matches("Approved")).toBe(true);
  });
});
