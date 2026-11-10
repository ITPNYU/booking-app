import "server-only";

import type { ApprovalFlow } from "@/components/src/client/routes/components/schemaTypes";
import { isMediaCommonsTenant } from "@/components/src/constants/tenants";
import {
  evaluateItpShouldAutoApprove,
  evaluateMcShouldAutoApprove,
  type ItpAutoApprovalContext,
  type McAutoApprovalContext,
} from "@/lib/stateMachines/autoApprovalGuards";
import { setup } from "xstate";
import type { MediaCommonsBookingContext } from "./mcBookingMachineTypes";
import { mcBookingActions, mcBookingGuards } from "./mcBookingMachineImpl";

type ApprovalFlowContext = McAutoApprovalContext &
  ItpAutoApprovalContext &
  MediaCommonsBookingContext;

type ApprovalAction =
  | string
  | { type: string; params?: Record<string, string> };

type ApprovalTransition = {
  target: string;
  guard?: string;
  actions?: ApprovalAction | ApprovalAction[];
};

type ApprovalStateNode = {
  initial?: string;
  states?: Record<string, ApprovalStateNode>;
  type?: "parallel" | "final";
  on?: Record<string, ApprovalTransition | ApprovalTransition[]>;
  onDone?: { target: string };
  always?: ApprovalTransition[];
  entry?: ApprovalAction[];
  after?: {
    delayMs: number;
    target: string;
    actions?: ApprovalAction | ApprovalAction[];
  }[];
};

function compileAction(action: ApprovalAction) {
  if (typeof action === "string") return action;
  return action.params
    ? { type: action.type, params: action.params }
    : { type: action.type };
}

function compileActions(actions: ApprovalAction | ApprovalAction[]) {
  return Array.isArray(actions)
    ? actions.map(compileAction)
    : compileAction(actions);
}

function compileTransition(transition: ApprovalTransition) {
  const compiled: Record<string, unknown> = { target: transition.target };
  if (transition.guard) compiled.guard = { type: transition.guard };
  if (transition.actions) compiled.actions = compileActions(transition.actions);
  return compiled;
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
        Array.isArray(transition)
          ? transition.map(compileTransition)
          : compileTransition(transition),
      ]),
    );
  }
  if (state.onDone) compiled.onDone = { target: state.onDone.target };
  if (state.always?.length) {
    compiled.always = state.always.map(compileTransition);
  }
  if (state.entry?.length) {
    compiled.entry = state.entry.map(compileAction);
  }
  if (state.after?.length) {
    compiled.after = Object.fromEntries(
      state.after.map((transition) => [
        transition.delayMs,
        compileTransition(transition),
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
  actions: mcBookingActions as never,
  guards: {
    ...mcBookingGuards,
    shouldAutoApprove: ({ context }: { context: ApprovalFlowContext }) =>
      isMediaCommonsTenant(context.tenant)
        ? evaluateMcShouldAutoApprove(context)
        : evaluateItpShouldAutoApprove(context),
    isVip: ({ context }: { context: ApprovalFlowContext }) =>
      context.isVip === true,
  } as never,
});

/** Build the machine a tenant document's `approvalFlow` describes. */
export function compileApprovalFlow(flow: ApprovalFlow) {
  const states = flow.states as Record<string, ApprovalStateNode>;
  return approvalFlowSetup.createMachine({
    id: flow.id ?? "Approval Flow",
    initial: flow.initial,
    context: ({ input }) => ({
      tenant: input?.tenant,
      selectedRooms: input?.selectedRooms || [],
      formData: input?.formData,
      bookingCalendarInfo: input?.bookingCalendarInfo,
      isWalkIn: input?.isWalkIn || false,
      isVip: input?.isVip || false,
      role: input?.role,
      origin: input?.origin,
      calendarEventId: input?.calendarEventId,
      email: input?.email,
      declineReason: input?.declineReason,
      automationReason: input?.automationReason,
      servicesRequested:
        input?.servicesRequested && typeof input.servicesRequested === "object"
          ? input.servicesRequested
          : undefined,
      servicesApproved:
        input?.servicesApproved && typeof input.servicesApproved === "object"
          ? input.servicesApproved
          : undefined,
      servicesAutoCloseout:
        input?.servicesAutoCloseout &&
        typeof input.servicesAutoCloseout === "object"
          ? input.servicesAutoCloseout
          : undefined,
      pendingSideEffects: input?.pendingSideEffects,
      _restoredFromStatus: input?._restoredFromStatus,
    }),
    states: compileStates(states),
  });
}
