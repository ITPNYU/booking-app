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
  return approvalFlowSetup.createMachine({
    id: flow.id,
    initial: flow.initial,
    context: ({ input }) => ({
      tenant: input?.tenant,
      selectedRooms: input?.selectedRooms || [],
      formData: input?.formData,
      bookingCalendarInfo: input?.bookingCalendarInfo,
      isWalkIn: input?.isWalkIn || false,
      isVip: input?.isVip || false,
      // The Media Commons builder never copies role, so hour limits stay on
      // the student tier. ITP's builder does copy role.
      ...(isMediaCommonsTenant(input?.tenant) ? {} : { role: input?.role }),
      origin: input?.origin,
      calendarEventId: input?.calendarEventId,
      email: input?.email,
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
    }),
    states: flow.states as never,
  });
}
