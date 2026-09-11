import "server-only";

import { BookingOrigin } from "@/components/src/types";
import { evaluateMcShouldAutoApprove } from "@/lib/stateMachines/autoApprovalGuards";
import {
  logAutomaticCancellationTransition,
  type AutomaticCancellationReason,
} from "@/lib/stateMachines/logAutomaticCancellationTransition";
import { and, assign } from "xstate";
import type {
  MediaCommonsBookingContext,
  MediaCommonsBookingEvent,
  MediaCommonsServiceKey,
} from "./mcBookingMachineTypes";

/**
 * Action and guard implementations for mcBookingMachine.
 *
 * mcBookingMachine.ts must stay a plain literal so Stately Studio can import
 * and export it. Everything that needs a function body lives here and is
 * referenced from the machine by name. Adding a guard/action name in Stately
 * without an implementation here fails `tsc` on the machine file.
 *
 * ⚠️ XSTATE PURITY CONSTRAINT:
 * Actions here only log or `assign`. No Firestore writes, emails, calendar
 * calls, or other I/O — those run in the orchestration layer after the
 * transition (see xstate-transition route / handleStateTransitions).
 */

type ActionArgs = {
  context: MediaCommonsBookingContext;
  event: MediaCommonsBookingEvent;
};

const timestamp = () => new Date().toISOString();

/**
 * `assign` bound to this machine's context/event types. `setup()` rejects an
 * assign created with the default `EventObject` event type, so every assign in
 * this file goes through one of these.
 */
const mcAssign = assign<
  MediaCommonsBookingContext,
  MediaCommonsBookingEvent,
  undefined,
  MediaCommonsBookingEvent,
  never
>;
const mcAssignWithParams = <TParams extends Record<string, unknown>>() =>
  assign<
    MediaCommonsBookingContext,
    MediaCommonsBookingEvent,
    TParams,
    MediaCommonsBookingEvent,
    never
  >;

/**
 * Initial context factory. Referenced (not inlined) from the machine so the
 * createMachine() literal stays free of function bodies.
 */
export const buildMcInitialContext = ({
  input,
}: {
  input?: MediaCommonsBookingContext;
}): MediaCommonsBookingContext => ({
  tenant: input?.tenant,
  selectedRooms: input?.selectedRooms || [],
  formData: input?.formData,
  bookingCalendarInfo: input?.bookingCalendarInfo,
  isWalkIn: input?.isWalkIn || false,
  calendarEventId: input?.calendarEventId,
  email: input?.email,
  isVip: input?.isVip || false,
  origin: input?.origin,
  servicesRequested:
    input?.servicesRequested && typeof input.servicesRequested === "object"
      ? input.servicesRequested
      : {},
  servicesApproved:
    input?.servicesApproved && typeof input.servicesApproved === "object"
      ? input.servicesApproved
      : {},
});

const hasAnyServiceRequested = (context: MediaCommonsBookingContext) =>
  context.servicesRequested && typeof context.servicesRequested === "object"
    ? Object.values(context.servicesRequested).some(Boolean)
    : false;

const serviceApprovalAction = (
  service: MediaCommonsServiceKey,
  approved: boolean,
) =>
  mcAssign({
    servicesApproved: ({ context }) => ({
      ...context.servicesApproved,
      [service]: approved,
    }),
  });

const serviceRequestedGuard =
  (service: MediaCommonsServiceKey, guardName: string) =>
  ({ context }: { context: MediaCommonsBookingContext }) => {
    const requested = context.servicesRequested?.[service] || false;
    console.log(`🎯 XSTATE GUARD: ${guardName}: ${requested}`);
    return requested;
  };

const serviceApprovedGuard =
  (service: MediaCommonsServiceKey, guardName: string) =>
  ({ context }: { context: MediaCommonsBookingContext }) => {
    const approved = context.servicesApproved?.[service] === true;
    console.log(`🎯 XSTATE GUARD: ${guardName}: ${approved}`);
    return approved;
  };

export const mcBookingActions = {
  /**
   * Generic state-entry log. Every state declares this with a `label` so the
   * transition trail stays visible in Cloud Logging without inline lambdas.
   */
  logStateEntry: ({ context }: ActionArgs, params: { label: string }) => {
    console.log(`🏁 XSTATE STATE: ${params.label} [MEDIA COMMONS]`, {
      tenant: context.tenant,
      timestamp: timestamp(),
      calendarEventId: context.calendarEventId,
      isVip: context.isVip,
      origin: context.origin,
      isPregame: context.origin === BookingOrigin.PREGAME,
      servicesRequested: context.servicesRequested,
      servicesApproved: context.servicesApproved,
    });
  },

  // Queue a side effect for the xstate-transition route to execute after
  // the machine finishes transitioning. Pure assign — safe on both server
  // and client.
  queueCancelProcessing: mcAssign({
    pendingSideEffects: ({ context }) => [
      ...(context.pendingSideEffects ?? []),
      "cancelProcessing",
    ],
  }),

  sendHTMLEmail: ({ context }: ActionArgs) => {
    // NOTE: This is a placeholder action for state machine logic only
    // Actual email sending is handled by traditional processing after XState
    console.log("📧 XSTATE ACTION: sendHTMLEmail executed (placeholder only)", {
      tenant: context.tenant,
      hasFormData: !!context.formData,
      email: context.email,
      note: "Actual email sending handled outside XState",
    });
  },
  createCalendarEvent: ({ context }: ActionArgs) => {
    // NOTE: This is a placeholder action for state machine logic only
    // Actual calendar creation is handled by traditional processing after XState
    console.log(
      "📅 XSTATE ACTION: createCalendarEvent executed (placeholder only)",
      {
        tenant: context.tenant,
        selectedRoomsCount: context.selectedRooms?.length || 0,
        calendarEventId: context.calendarEventId,
        note: "Actual calendar creation handled outside XState",
      },
    );
  },
  updateCalendarEvent: ({ context }: ActionArgs) => {
    // NOTE: This is a placeholder action for state machine logic only
    // Actual calendar update is handled by traditional processing after XState
    console.log(
      "📅 XSTATE ACTION: updateCalendarEvent executed (placeholder only)",
      {
        tenant: context.tenant,
        calendarEventId: context.calendarEventId,
        note: "Actual calendar update handled outside XState",
      },
    );
  },
  deleteCalendarEvent: ({ context }: ActionArgs) => {
    // NOTE: This is a placeholder action for state machine logic only
    // Actual calendar deletion is handled by traditional processing after XState
    console.log(
      "🗑️ XSTATE ACTION: deleteCalendarEvent executed (placeholder only)",
      {
        tenant: context.tenant,
        calendarEventId: context.calendarEventId,
        note: "Actual calendar deletion handled outside XState",
      },
    );
  },
  logBookingHistory: async (
    { context, event }: ActionArgs,
    params: { status?: string; note?: string } = {},
  ) => {
    // Log booking history directly from XState
    try {
      const { logServerBookingChange, serverGetDataByCalendarEventId } =
        await import("@/lib/firebase/server/adminDb");
      const { TableNames } = await import("@/components/src/policy");

      // Get the action parameters from the second argument
      const status = params?.status;
      const note = params?.note;

      if (!status) {
        console.warn(
          `⚠️ XSTATE HISTORY LOG SKIPPED - NO STATUS [${context.tenant?.toUpperCase()}]:`,
          { calendarEventId: context.calendarEventId },
        );
        return;
      }

      // Get booking document to get bookingId and requestNumber
      const bookingDoc = await serverGetDataByCalendarEventId(
        TableNames.BOOKING,
        context.calendarEventId,
        context.tenant,
      );

      if (!bookingDoc) {
        console.error(
          `❌ XSTATE HISTORY LOG: Booking not found [${context.tenant?.toUpperCase()}]`,
          { calendarEventId: context.calendarEventId },
        );
        return;
      }

      const actorEmail =
        typeof (event as any)?.email === "string" && (event as any).email.trim()
          ? (event as any).email.trim()
          : context.email;

      await logServerBookingChange({
        bookingId: bookingDoc.id,
        calendarEventId: context.calendarEventId,
        status: status as any, // Type assertion for dynamic import
        changedBy: actorEmail || "system",
        requestNumber: (bookingDoc as any).requestNumber || 0,
        note: note || "",
        tenant: context.tenant,
      });

      console.log(
        `📋 XSTATE HISTORY LOGGED [${context.tenant?.toUpperCase() || "UNKNOWN"}]:`,
        {
          calendarEventId: context.calendarEventId,
          status,
          note,
        },
      );
    } catch (error) {
      console.error(
        `🚨 XSTATE HISTORY LOG FAILED [${context.tenant?.toUpperCase() || "UNKNOWN"}]:`,
        {
          calendarEventId: context.calendarEventId,
          error: error.message,
        },
      );
    }
  },
  inviteUserToCalendarEvent: ({ context }: ActionArgs) => {
    console.log("👥 XSTATE ACTION: inviteUserToCalendarEvent executed", {
      tenant: context.tenant,
      calendarEventId: context.calendarEventId,
      email: context.email,
    });
  },
  setDeclineReason: mcAssign({
    declineReason: ({ event }) => {
      const { reason } = event as any;
      if (reason && reason.trim()) {
        return reason;
      }
      return "Service requirements could not be fulfilled";
    },
  }),
  /**
   * Marks an automatic transition (no-show / decline timeout) so the
   * Canceled entry can write the right history note.
   */
  setAutomationReason: mcAssignWithParams<{
    reason: AutomaticCancellationReason;
  }>()({
    automationReason: (_, params) => params.reason,
  }),
  logCanceledAfterAutomaticTransition: async ({
    context,
  }: ActionArgs): Promise<void> => {
    await logAutomaticCancellationTransition(context);
  },

  // Per-service approval decisions. One pair per region of "Services Request".
  approveStaffService: serviceApprovalAction("staff", true),
  declineStaffService: serviceApprovalAction("staff", false),
  approveCateringService: serviceApprovalAction("catering", true),
  declineCateringService: serviceApprovalAction("catering", false),
  approveSetupService: serviceApprovalAction("setup", true),
  declineSetupService: serviceApprovalAction("setup", false),
  approveCleaningService: serviceApprovalAction("cleaning", true),
  declineCleaningService: serviceApprovalAction("cleaning", false),
  approveSecurityService: serviceApprovalAction("security", true),
  declineSecurityService: serviceApprovalAction("security", false),
  approveEquipmentService: serviceApprovalAction("equipment", true),
  declineEquipmentService: serviceApprovalAction("equipment", false),

  resetServiceDecisionsOnEdit: mcAssign({
    servicesApproved: () => ({}),
  }),

  // Close processing is now handled by callers (db.ts, cron, /api/services) after XState transition
  // to keep the same pattern across all tenants (MC, ITP, etc.)
  handleCloseProcessing: ({ context }: ActionArgs) => {
    console.log(
      "🎬 XSTATE ACTION: handleCloseProcessing (no-op, handled by callers)",
      {
        calendarEventId: context.calendarEventId,
        tenant: context.tenant,
      },
    );
  },

  // Checkout processing is now handled by db.ts after XState transition
  // to keep the same pattern across all tenants (MC, ITP, etc.)
  handleCheckoutProcessing: ({ context }: ActionArgs) => {
    console.log(
      "🎬 XSTATE ACTION: handleCheckoutProcessing (no-op, handled by db.ts)",
      {
        calendarEventId: context.calendarEventId,
        tenant: context.tenant,
      },
    );
  },
};

export const mcBookingGuards = {
  shouldAutoApprove: ({ context }: { context: MediaCommonsBookingContext }) =>
    evaluateMcShouldAutoApprove(context),
  "isVip AND servicesRequested": and([
    ({ context }: { context: MediaCommonsBookingContext }) => {
      const isVip = context.isVip || false;
      console.log(`🎯 XSTATE GUARD: Checking isVip: ${isVip}`);
      return isVip;
    },
    ({ context }: { context: MediaCommonsBookingContext }) => {
      const hasServices = hasAnyServiceRequested(context);
      console.log(
        `🎯 XSTATE GUARD: Checking servicesRequested: ${hasServices}`,
      );
      return hasServices;
    },
  ]),
  servicesRequested: ({ context }: { context: MediaCommonsBookingContext }) => {
    const hasServices = hasAnyServiceRequested(context);
    console.log(`🎯 XSTATE GUARD: servicesRequested: ${hasServices}`);
    return hasServices;
  },
  servicesApproved: ({ context }: { context: MediaCommonsBookingContext }) => {
    if (
      !context.servicesRequested ||
      typeof context.servicesRequested !== "object"
    )
      return false;

    // Check if any services are actually requested
    const hasRequestedServices = Object.values(context.servicesRequested).some(
      Boolean,
    );

    // If no services are requested, consider all "approved"
    if (!hasRequestedServices) {
      console.log(
        "🎯 XSTATE GUARD: servicesApproved: true (no services requested)",
      );
      return true;
    }

    // If services are requested, check if all requested services are approved
    if (
      !context.servicesApproved ||
      typeof context.servicesApproved !== "object"
    )
      return false;

    const allApproved = Object.entries(context.servicesRequested).every(
      ([service, requested]) => {
        if (!requested) return true; // If not requested, consider it "approved"
        return (
          context.servicesApproved?.[
            service as keyof typeof context.servicesApproved
          ] === true
        );
      },
    );

    console.log(`🎯 XSTATE GUARD: servicesApproved: ${allApproved}`);
    return allApproved;
  },
  servicesDeclined: ({ context }: { context: MediaCommonsBookingContext }) => {
    if (
      !context.servicesRequested ||
      typeof context.servicesRequested !== "object" ||
      !context.servicesApproved ||
      typeof context.servicesApproved !== "object"
    )
      return false;

    // First, check if ALL requested services have been decided (approved or declined)
    const allServicesDecided = Object.entries(context.servicesRequested).every(
      ([service, requested]) => {
        if (!requested) return true; // If not requested, it's considered "decided"
        const approval =
          context.servicesApproved?.[
            service as keyof typeof context.servicesApproved
          ];
        return typeof approval === "boolean"; // Must be explicitly true or false
      },
    );

    if (!allServicesDecided) {
      console.log(
        "🎯 XSTATE GUARD: servicesDeclined: false (not all services decided yet)",
      );
      return false;
    }

    // If all services are decided, check if any requested service is explicitly declined
    const anyDeclined = Object.entries(context.servicesRequested).some(
      ([service, requested]) => {
        if (!requested) return false; // If not requested, can't be declined
        return (
          context.servicesApproved?.[
            service as keyof typeof context.servicesApproved
          ] === false
        );
      },
    );

    console.log(
      `🎯 XSTATE GUARD: servicesDeclined: ${anyDeclined} (all services decided: ${allServicesDecided})`,
    );
    return anyDeclined;
  },

  // Per-service requested/approved guards. One pair per service region.
  staffRequested: serviceRequestedGuard("staff", "staffRequested"),
  staffApproved: serviceApprovedGuard("staff", "staffApproved"),
  caterRequested: serviceRequestedGuard("catering", "caterRequested"),
  cateringApproved: serviceApprovedGuard("catering", "cateringApproved"),
  setupRequested: serviceRequestedGuard("setup", "setupRequested"),
  setupApproved: serviceApprovedGuard("setup", "setupApproved"),
  cleanRequested: serviceRequestedGuard("cleaning", "cleanRequested"),
  cleanApproved: serviceApprovedGuard("cleaning", "cleanApproved"),
  securityRequested: serviceRequestedGuard("security", "securityRequested"),
  securityApproved: serviceApprovedGuard("security", "securityApproved"),
  equipRequested: serviceRequestedGuard("equipment", "equipRequested"),
  equipApproved: serviceApprovedGuard("equipment", "equipApproved"),
};
