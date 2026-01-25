import type { ActorRefFrom } from "xstate";
import { createActor } from "xstate";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestMachine, createTestModel } from "@xstate/test";

import { mcBookingMachine } from "@/lib/stateMachines/mcBookingMachine";

type BookingInput = Parameters<
  (typeof mcBookingMachine)["createActor"]
>[0]["input"];

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
  BookingOrigin: {
    USER: "user",
    ADMIN: "admin",
    WALK_IN: "walk-in",
    VIP: "vip",
    SYSTEM: "system",
    PREGAME: "pre-game",
  },
}));

const mockFetch = vi.fn();

// Create a test-friendly copy of the machine by stripping unsupported features
// (invoke/after) so @xstate/test can traverse it.
const createTestReadyMachine = (defaultInput?: BookingInput) => {
  const baseConfig = mcBookingMachine.config;
  const originalContextFactory = baseConfig.context;

  const canceledState = baseConfig.states?.Canceled;
  const sanitizedCanceled = canceledState
    ? {
        ...canceledState,
        always: [
          ...(canceledState.always ?? []),
          ...(Array.isArray(canceledState.invoke?.onDone)
            ? canceledState.invoke.onDone.map((transition: any) => ({
                ...transition,
              }))
            : []),
          { target: "Closed" },
        ],
      }
    : undefined;

  if (sanitizedCanceled) {
    delete (sanitizedCanceled as any).invoke;
  }

  const declinedState = baseConfig.states?.Declined;
  const sanitizedDeclined = declinedState
    ? {
        ...declinedState,
      }
    : undefined;

  if (sanitizedDeclined && "after" in sanitizedDeclined) {
    delete (sanitizedDeclined as any).after;
  }

  const sanitizedConfig = {
    ...baseConfig,
    context: ({ input }: { input?: BookingInput }) =>
      originalContextFactory({
        input: (input ?? defaultInput ?? undefined) as BookingInput,
      }),
    states: {
      ...baseConfig.states,
      ...(sanitizedCanceled ? { Canceled: sanitizedCanceled } : {}),
      ...(sanitizedDeclined ? { Declined: sanitizedDeclined } : {}),
    },
  };

  const implementations = mcBookingMachine.implementations;

  const machine = createTestMachine(sanitizedConfig as any, {
    actions: implementations.actions,
    guards: implementations.guards,
  }).provide({
    actions: {
      sendHTMLEmail: () => undefined,
      createCalendarEvent: () => undefined,
      updateCalendarEvent: () => undefined,
      deleteCalendarEvent: () => undefined,
      inviteUserToCalendarEvent: () => undefined,
      handleCloseProcessing: () => undefined,
      handleCheckoutProcessing: () => undefined,
      logBookingHistory: () => undefined,
    },
  });

  return withActionExecutor(machine);
};

const withActionExecutor = <TMachine extends {
  getInitialSnapshot: (...args: any[]) => any;
  transition: (...args: any[]) => any;
}>(machine: TMachine) => {
  const ensureActionExecutor = (actorScope: any) => {
    if (!actorScope || typeof actorScope !== "object") return;
    if (typeof actorScope.actionExecutor === "function") return;
    actorScope.actionExecutor = ({
      exec,
      info,
      params,
    }: {
      exec?: ((info: any, params?: any) => void) | undefined;
      info?: any;
      params?: any;
    }) => {
      if (typeof exec === "function") {
        exec(info, params);
      }
    };
  };

  const originalGetInitialSnapshot = machine.getInitialSnapshot.bind(machine);
  machine.getInitialSnapshot = (actorScope: any, input?: BookingInput) => {
    ensureActionExecutor(actorScope);
    return originalGetInitialSnapshot(actorScope, input);
  };

  const originalTransition = machine.transition.bind(machine);
  machine.transition = (snapshot: any, event: any, actorScope: any) => {
    ensureActionExecutor(actorScope);
    return originalTransition(snapshot, event, actorScope);
  };

  return machine;
};

const createEventExecutors = (actor: ActorRefFrom<(typeof mcBookingMachine)["createActor"]>) => ({
  approve: () => actor.send({ type: "approve" }),
  decline: () => actor.send({ type: "decline" }),
  approveEquipment: () => actor.send({ type: "approveEquipment" }),
  approveStaff: () => actor.send({ type: "approveStaff" }),
  declineEquipment: () => actor.send({ type: "declineEquipment" }),
  cancel: () => actor.send({ type: "cancel" }),
  closeoutStaff: () => actor.send({ type: "closeoutStaff" }),
  checkIn: () => actor.send({ type: "checkIn" }),
  checkOut: () => actor.send({ type: "checkOut" }),
  closeoutEquipment: () => actor.send({ type: "closeoutEquipment" }),
  noShow: () => actor.send({ type: "noShow" }),
  autoCloseScript: () => actor.send({ type: "autoCloseScript" }),
});

const createStateAssertions = (
  actor: ActorRefFrom<(typeof mcBookingMachine)["createActor"]>
) => ({
  Requested: () => expect(actor.getSnapshot().matches("Requested")).toBe(true),
  "Pre-approved": () =>
    expect(actor.getSnapshot().matches("Pre-approved")).toBe(true),
  "Services Request": () =>
    expect(actor.getSnapshot().matches("Services Request")).toBe(true),
  Approved: () => expect(actor.getSnapshot().matches("Approved")).toBe(true),
  Declined: () => expect(actor.getSnapshot().matches("Declined")).toBe(true),
  Canceled: () => expect(actor.getSnapshot().matches("Canceled")).toBe(true),
  "Service Closeout": () =>
    expect(actor.getSnapshot().matches("Service Closeout")).toBe(true),
  Closed: () => expect(actor.getSnapshot().matches("Closed")).toBe(true),
  "Checked In": () =>
    expect(actor.getSnapshot().matches("Checked In")).toBe(true),
  "Checked Out": () =>
    expect(actor.getSnapshot().matches("Checked Out")).toBe(true),
  "No Show": () => expect(actor.getSnapshot().matches("No Show")).toBe(true),
  "Evaluate Services Request": () =>
    expect(actor.getSnapshot().matches("Evaluate Services Request")).toBe(true),
});

describe("@xstate/test coverage for mcBookingMachine", () => {
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
      id: "booking-xyz",
      requestNumber: 999,
    });
    mockServerUpdateDataByCalendarEventId.mockReset();
    mockServerSaveDataToFirestore.mockReset();
  });

  type TestScenario = {
    description: string;
    input: BookingInput;
    events: { type: string }[];
    expected: string;
    postCheck?: (
      actor: ActorRefFrom<(typeof mcBookingMachine)["createActor"]>,
    ) => void;
  };

  const scenarios: TestScenario[] = [
    {
      description:
        "auto-approval with equipment service checks in, checks out, and closes via equipment closeout",
      input: {
        tenant: "mc",
        calendarEventId: "cal-auto-equip",
        email: "auto-equip@nyu.edu",
        bookingCalendarInfo: makeCalendarInfo(),
        selectedRooms: [{ roomId: 202, shouldAutoApprove: true }],
        servicesRequested: { equipment: true },
        servicesApproved: { equipment: true },
        isWalkIn: true,
      },
      events: [
        { type: "checkIn" },
        { type: "checkOut" },
        { type: "closeoutEquipment" },
      ],
      expected: "Closed",
    },
    {
      description:
        "manual approvals progress through services request to Approved",
      input: {
        tenant: "mc",
        calendarEventId: "cal-manual",
        email: "manual@nyu.edu",
        bookingCalendarInfo: makeCalendarInfo(),
        selectedRooms: [{ roomId: 202, shouldAutoApprove: false }],
        servicesRequested: { equipment: true, staff: true },
      },
      events: [
        { type: "approve" },
        { type: "approve" },
        { type: "approveEquipment" },
        { type: "approveStaff" },
      ],
      expected: "Approved",
    },
    {
      description: "services decline path settles in Declined state",
      input: {
        tenant: "mc",
        calendarEventId: "cal-decline",
        email: "decline@nyu.edu",
        bookingCalendarInfo: makeCalendarInfo(),
        selectedRooms: [{ roomId: 202, shouldAutoApprove: false }],
        servicesRequested: { equipment: true },
      },
      events: [
        { type: "approve" },
        { type: "approve" },
        { type: "declineEquipment" },
      ],
      expected: "Declined",
    },
    {
      description: "cancellation with staff closeout reaches Closed",
      input: {
        tenant: "mc",
        calendarEventId: "cal-cancel-after-approved",
        email: "cancel@nyu.edu",
        bookingCalendarInfo: makeCalendarInfo(),
        selectedRooms: [{ roomId: 202, shouldAutoApprove: false }],
        servicesRequested: { staff: true },
        servicesApproved: { staff: true },
      },
      events: [{ type: "cancel" }, { type: "closeoutStaff" }],
      expected: "Closed",
    },
    {
      description: "manual approval with no services reaches Approved",
      input: {
        tenant: "mc",
        calendarEventId: "cal-no-services",
        email: "noservices@nyu.edu",
        bookingCalendarInfo: makeCalendarInfo(),
        selectedRooms: [{ roomId: 303, shouldAutoApprove: false }],
      },
      events: [{ type: "approve" }, { type: "approve" }],
      expected: "Approved",
    },
    {
      description:
        "pre-approved decline uses default decline reason and ends in Declined",
      input: {
        tenant: "mc",
        calendarEventId: "cal-pre-decline",
        email: "predecline@nyu.edu",
        bookingCalendarInfo: makeCalendarInfo(),
        selectedRooms: [{ roomId: 404, shouldAutoApprove: false }],
      },
      events: [{ type: "approve" }, { type: "decline" }],
      expected: "Declined",
      postCheck: (actor: ActorRefFrom<(typeof mcBookingMachine)["createActor"]>) => {
        expect(actor.getSnapshot().context.declineReason).toBe(
          "Service requirements could not be fulfilled",
        );
      },
    },
    {
      description: "requested decline immediately ends in Declined",
      input: {
        tenant: "mc",
        calendarEventId: "cal-request-decline",
        email: "reqdecline@nyu.edu",
        bookingCalendarInfo: makeCalendarInfo(),
        selectedRooms: [{ roomId: 505, shouldAutoApprove: false }],
      },
      events: [{ type: "decline" }],
      expected: "Declined",
    },
    {
      description: "no show path cancels and closes the booking",
      input: {
        tenant: "mc",
        calendarEventId: "cal-noshow",
        email: "noshow@nyu.edu",
        bookingCalendarInfo: makeCalendarInfo(),
        selectedRooms: [{ roomId: 606, shouldAutoApprove: true }],
        isWalkIn: true,
      },
      events: [{ type: "noShow" }],
      expected: "Closed",
    },
    {
      description: "auto close script transitions Approved booking to Closed",
      input: {
        tenant: "mc",
        calendarEventId: "cal-autoclose",
        email: "autoclose@nyu.edu",
        bookingCalendarInfo: makeCalendarInfo(),
        selectedRooms: [{ roomId: 707, shouldAutoApprove: true }],
      },
      events: [{ type: "autoCloseScript" }],
      expected: "Closed",
    },
    {
      description: "cancel without services closes the booking",
      input: {
        tenant: "mc",
        calendarEventId: "cal-cancel-noservices",
        email: "cancelnoservices@nyu.edu",
        bookingCalendarInfo: makeCalendarInfo(),
        selectedRooms: [{ roomId: 808, shouldAutoApprove: true }],
      },
      events: [{ type: "cancel" }],
      expected: "Closed",
    },
    {
      description:
        "VIP booking immediately enters services request and approves pending services",
      input: {
        tenant: "mc",
        calendarEventId: "cal-vip",
        email: "vip@nyu.edu",
        bookingCalendarInfo: makeCalendarInfo(),
        selectedRooms: [{ roomId: 909, shouldAutoApprove: false }],
        isVip: true,
        servicesRequested: { equipment: true, staff: true },
      },
      events: [{ type: "approveEquipment" }, { type: "approveStaff" }],
      expected: "Approved",
    },
    {
      description:
        "pre-approved booking with services cancels before approvals and still closes",
      input: {
        tenant: "mc",
        calendarEventId: "cal-pre-cancel",
        email: "precancel@nyu.edu",
        bookingCalendarInfo: makeCalendarInfo(),
        selectedRooms: [{ roomId: 1001, shouldAutoApprove: false }],
        servicesRequested: { staff: true },
      },
      events: [{ type: "approve" }, { type: "cancel" }],
      expected: "Closed",
    },
    {
      description:
        "services request cancels mid-approval and transitions through service closeout",
      input: {
        tenant: "mc",
        calendarEventId: "cal-service-cancel",
        email: "servicecancel@nyu.edu",
        bookingCalendarInfo: makeCalendarInfo(),
        selectedRooms: [{ roomId: 1102, shouldAutoApprove: false }],
        servicesRequested: { equipment: true, staff: true },
      },
      events: [
        { type: "approve" },
        { type: "approve" },
        { type: "cancel" },
      ],
      expected: "Closed",
    },
  ] as const;

  scenarios.forEach((scenario) => {
    const { description, input, events, expected, postCheck } = scenario;
    it(description, async () => {
      const testMachine = createTestReadyMachine(input);
      const testModel = createTestModel(testMachine);

      const actor = createActor(testMachine, { input });
      actor.start();

      const paths = testModel.getPathsFromEvents(events);

      expect(paths.length).toBeGreaterThan(0);
      const path = paths[0];

      await path.test({
        events: createEventExecutors(actor),
        states: createStateAssertions(actor),
      });

      expect(actor.getSnapshot().matches(expected)).toBe(true);
      postCheck?.(actor);
    });
  });
});
