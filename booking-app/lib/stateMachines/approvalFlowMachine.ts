import "server-only";

import { isMediaCommonsTenant } from "@/components/src/constants/tenants";
import type { ApprovalFlow } from "@/components/src/client/routes/components/schemaTypes";
import {
  evaluateItpShouldAutoApprove,
  evaluateMcShouldAutoApprove,
  type ItpAutoApprovalContext,
  type McAutoApprovalContext,
} from "@/lib/stateMachines/autoApprovalGuards";
import { assign, setup } from "xstate";
import type {
  MediaCommonsBookingContext,
  MediaCommonsBookingEvent,
} from "./mcBookingMachineTypes";
import { mcBookingActions, mcBookingGuards } from "./mcBookingMachineImpl";

type ApprovalFlowContext = McAutoApprovalContext &
  ItpAutoApprovalContext & {
    calendarEventId?: string | null;
    email?: string;
    servicesApproved?: Record<string, boolean>;
    servicesAutoCloseout?: Record<string, boolean>;
    pendingSideEffects?: string[];
  };

type ApprovalTransition = {
  target: string;
  guard?: string;
};

type ApprovalStateNode = {
  initial?: string;
  states?: Record<string, ApprovalStateNode>;
  type?: "parallel" | "final";
  on?: Record<string, ApprovalTransition>;
  always?: ApprovalTransition[];
  entry?: string[];
  after?: { delayMs: number; target: string }[];
};

function namedGuard(guard?: string) {
  return guard ? { type: guard } : undefined;
}

function compileTransition(transition: ApprovalTransition) {
  const guard = namedGuard(transition.guard);
  return guard
    ? { target: transition.target, guard }
    : { target: transition.target };
}

function compileState(state: ApprovalStateNode): Record<string, unknown> {
  const compiled: Record<string, unknown> = {};
  if (state.type) compiled.type = state.type;
  if (state.initial && state.type !== "parallel") compiled.initial = state.initial;
  if (state.states) compiled.states = compileStates(state.states);
  if (state.on) {
    compiled.on = Object.fromEntries(
      Object.entries(state.on).map(([event, transition]) => [
        event,
        compileTransition(transition),
      ]),
    );
  }
  if (state.always?.length) {
    compiled.always = state.always.map(compileTransition);
  }
  if (state.entry?.length) {
    compiled.entry = state.entry.map((type) => ({ type }));
  }
  if (state.after?.length) {
    compiled.after = Object.fromEntries(
      state.after.map((transition) => [
        transition.delayMs,
        { target: transition.target },
      ]),
    );
  }
  return compiled;
}

function compileStates(states: Record<string, ApprovalStateNode>) {
  return Object.fromEntries(
    Object.entries(states).map(([name, state]) => [name, compileState(state)]),
  );
}

const approvalFlowSetup = setup({
  types: {
    context: {} as ApprovalFlowContext,
    events: {} as { type: string },
    input: {} as Partial<ApprovalFlowContext> | undefined,
  },
  actions: {
    sendHTMLEmail: ({ context, event }) =>
      mcBookingActions.sendHTMLEmail({
        context: context as MediaCommonsBookingContext,
        event: event as MediaCommonsBookingEvent,
      }),
    createCalendarEvent: ({ context, event }) =>
      mcBookingActions.createCalendarEvent({
        context: context as MediaCommonsBookingContext,
        event: event as MediaCommonsBookingEvent,
      }),
    updateCalendarEvent: ({ context, event }) =>
      mcBookingActions.updateCalendarEvent({
        context: context as MediaCommonsBookingContext,
        event: event as MediaCommonsBookingEvent,
      }),
    queueCancelProcessing: assign({
      pendingSideEffects: ({ context }) => [
        ...(context.pendingSideEffects ?? []),
        "cancelProcessing",
      ],
    }),
  },
  guards: {
    shouldAutoApprove: ({ context }) =>
      isMediaCommonsTenant(context.tenant)
        ? evaluateMcShouldAutoApprove(context)
        : evaluateItpShouldAutoApprove(context),
    servicesRequested: ({ context }) =>
      mcBookingGuards.servicesRequested({
        context: context as MediaCommonsBookingContext,
      }),
    isVip: ({ context }) => context.isVip === true,
  },
});

/** Build the machine a tenant document's `approvalFlow` describes. */
export function compileApprovalFlow(flow: ApprovalFlow) {
  const states = flow.states as Record<string, ApprovalStateNode>;
  return approvalFlowSetup.createMachine({
    id: "Approval Flow",
    initial: flow.initial,
    context: ({ input }) => ({
      tenant: input?.tenant,
      selectedRooms: input?.selectedRooms,
      formData: input?.formData,
      bookingCalendarInfo: input?.bookingCalendarInfo,
      isWalkIn: input?.isWalkIn ?? false,
      isVip: input?.isVip ?? false,
      role: input?.role,
      calendarEventId: input?.calendarEventId,
      email: input?.email,
      servicesRequested: input?.servicesRequested,
      servicesApproved: input?.servicesApproved,
      servicesAutoCloseout: input?.servicesAutoCloseout,
      pendingSideEffects: input?.pendingSideEffects,
      _restoredFromStatus: input?._restoredFromStatus,
    }),
    states: compileStates(states),
  });
}
