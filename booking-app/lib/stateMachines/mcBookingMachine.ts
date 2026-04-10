import { getBookingHourLimits } from "@/components/src/client/routes/booking/utils/bookingHourLimits";
import { TENANTS } from "@/components/src/constants/tenants";
import { BookingOrigin, Role } from "@/components/src/types";
import { BookingLogger } from "@/lib/logger/bookingLogger";
import { logAutomaticCancellationTransition, type AutomaticCancellationReason } from "@/lib/stateMachines/logAutomaticCancellationTransition";
import { and, assign, setup } from "xstate";
import { checkAutoApprovalEligibility } from "@/lib/utils/autoApprovalUtils";

// Time constants for clarity
const ONE_HOUR_IN_MS = 60 * 60 * 1000;

// Service configuration for factory-generated states
interface ServiceConfig {
  name: string;
  contextKey: keyof NonNullable<MediaCommonsBookingContext["servicesRequested"]>;
  requestGuard: string;
  approvedGuard: string;
  approveEvent: string;
  declineEvent: string;
  closeoutEvent: string;
  approveAction: string;
  declineAction: string;
}

const SERVICE_CONFIGS: ServiceConfig[] = [
  { name: "Staff",     contextKey: "staff",     requestGuard: "staffRequested",    approvedGuard: "staffApproved",    approveEvent: "approveStaff",     declineEvent: "declineStaff",     closeoutEvent: "closeoutStaff",     approveAction: "approveStaffService",     declineAction: "declineStaffService" },
  { name: "Catering",  contextKey: "catering",  requestGuard: "caterRequested",    approvedGuard: "cateringApproved", approveEvent: "approveCatering",  declineEvent: "declineCatering",  closeoutEvent: "closeoutCatering",  approveAction: "approveCateringService",  declineAction: "declineCateringService" },
  { name: "Setup",     contextKey: "setup",     requestGuard: "setupRequested",    approvedGuard: "setupApproved",    approveEvent: "approveSetup",     declineEvent: "declineSetup",     closeoutEvent: "closeoutSetup",     approveAction: "approveSetupService",     declineAction: "declineSetupService" },
  { name: "Cleaning",  contextKey: "cleaning",  requestGuard: "cleanRequested",    approvedGuard: "cleanApproved",    approveEvent: "approveCleaning",  declineEvent: "declineCleaning",  closeoutEvent: "closeoutCleaning",  approveAction: "approveCleaningService",  declineAction: "declineCleaningService" },
  { name: "Security",  contextKey: "security",  requestGuard: "securityRequested", approvedGuard: "securityApproved", approveEvent: "approveSecurity",  declineEvent: "declineSecurity",  closeoutEvent: "closeoutSecurity",  approveAction: "approveSecurityService",  declineAction: "declineSecurityService" },
  { name: "Equipment", contextKey: "equipment", requestGuard: "equipRequested",    approvedGuard: "equipApproved",    approveEvent: "approveEquipment", declineEvent: "declineEquipment", closeoutEvent: "closeoutEquipment", approveAction: "approveEquipmentService", declineAction: "declineEquipmentService" },
];

function createServiceRequestState(config: ServiceConfig) {
  return {
    initial: `Evaluate ${config.name} Request`,
    states: {
      [`Evaluate ${config.name} Request`]: {
        always: [
          { target: `${config.name} Requested`, guard: { type: config.requestGuard } },
          { target: `${config.name} Approved` },
        ],
        entry: [
          ({ context }: any) => {
            console.log(
              `🔍 XSTATE SUBSTATE: Evaluating ${config.name} Request [MEDIA COMMONS]`,
              { tenant: context.tenant, [`${config.contextKey}Requested`]: context.servicesRequested?.[config.contextKey], timestamp: new Date().toISOString() },
            );
          },
        ],
      },
      [`${config.name} Requested`]: {
        on: {
          [config.declineEvent]: { target: `${config.name} Declined`, actions: config.declineAction },
          [config.approveEvent]: { target: `${config.name} Approved`, actions: config.approveAction },
        },
        entry: [
          ({ context }: any) => {
            console.log(
              `⏳ XSTATE SUBSTATE: ${config.name} Request Pending Approval [MEDIA COMMONS]`,
              { tenant: context.tenant, timestamp: new Date().toISOString() },
            );
          },
        ],
      },
      [`${config.name} Approved`]: {
        type: "final" as const,
        entry: [
          ({ context }: any) => {
            console.log(
              `✅ XSTATE SUBSTATE: ${config.name} Request APPROVED [MEDIA COMMONS]`,
              { tenant: context.tenant, timestamp: new Date().toISOString() },
            );
          },
        ],
      },
      [`${config.name} Declined`]: {
        type: "final" as const,
        entry: [
          ({ context }: any) => {
            console.log(
              `❌ XSTATE SUBSTATE: ${config.name} Request DECLINED [MEDIA COMMONS]`,
              { tenant: context.tenant, timestamp: new Date().toISOString() },
            );
          },
        ],
      },
    },
  };
}

function createServiceCloseoutState(config: ServiceConfig) {
  return {
    initial: `Evaluate ${config.name}`,
    states: {
      [`Evaluate ${config.name}`]: {
        always: [
          { target: `${config.name} Closeout Pending`, guard: { type: config.approvedGuard } },
          { target: `${config.name} Closedout` },
        ],
        entry: [
          ({ context }: any) => {
            console.log(
              `🔍 XSTATE CLOSEOUT: Evaluating ${config.name} Closeout [MEDIA COMMONS]`,
              { tenant: context.tenant, [`${config.contextKey}Approved`]: context.servicesApproved?.[config.contextKey], timestamp: new Date().toISOString() },
            );
          },
        ],
      },
      [`${config.name} Closeout Pending`]: {
        on: {
          [config.closeoutEvent]: { target: `${config.name} Closedout` },
        },
        entry: [
          ({ context }: any) => {
            console.log(
              `⏳ XSTATE CLOSEOUT: ${config.name} Closeout Pending [MEDIA COMMONS]`,
              { tenant: context.tenant, timestamp: new Date().toISOString() },
            );
          },
        ],
      },
      [`${config.name} Closedout`]: {
        type: "final" as const,
        entry: [
          ({ context }: any) => {
            console.log(
              `✅ XSTATE CLOSEOUT: ${config.name} CLOSED OUT [MEDIA COMMONS]`,
              { tenant: context.tenant, timestamp: new Date().toISOString() },
            );
          },
        ],
      },
    },
  };
}

function createServiceActions(configs: ServiceConfig[]) {
  const actions: Record<string, any> = {};
  for (const config of configs) {
    actions[config.approveAction] = assign({
      servicesApproved: ({ context }: any) => ({
        ...context.servicesApproved,
        [config.contextKey]: true,
      }),
    });
    actions[config.declineAction] = assign({
      servicesApproved: ({ context }: any) => ({
        ...context.servicesApproved,
        [config.contextKey]: false,
      }),
    });
  }
  return actions;
}

function createServiceGuards(configs: ServiceConfig[]) {
  const guards: Record<string, any> = {};
  for (const config of configs) {
    guards[config.requestGuard] = ({ context }: any) => {
      const requested = context.servicesRequested?.[config.contextKey] || false;
      console.log(`🎯 XSTATE GUARD: ${config.requestGuard}: ${requested}`);
      return requested;
    };
    guards[config.approvedGuard] = ({ context }: any) => {
      const approved = context.servicesApproved?.[config.contextKey] === true;
      console.log(`🎯 XSTATE GUARD: ${config.approvedGuard}: ${approved}`);
      return approved;
    };
  }
  return guards;
}

// Define context type for type safety
interface MediaCommonsBookingContext {
  tenant?: string;
  selectedRooms?: any[];
  formData?: any;
  bookingCalendarInfo?: any;
  isWalkIn?: boolean;
  calendarEventId?: string | null;
  email?: string;
  isVip?: boolean;
  role?: Role;
  declineReason?: string;
  origin?: string;
  automationReason?: AutomaticCancellationReason; // Tracks automatic transitions
  servicesRequested?: {
    staff?: boolean;
    equipment?: boolean;
    catering?: boolean;
    cleaning?: boolean;
    security?: boolean;
    setup?: boolean;
  };
  servicesApproved?: {
    staff?: boolean;
    equipment?: boolean;
    catering?: boolean;
    cleaning?: boolean;
    security?: boolean;
    setup?: boolean;
  };
  // Flag to indicate this XState was created from existing booking without prior xstateData
  _restoredFromStatus?: boolean;
}

// ⚠️ XSTATE PURITY CONSTRAINT:
// This XState machine should ONLY handle state transitions and logging
// DO NOT add side effects like:
// - Database operations (Firestore writes)
// - Email sending (actual API calls)
// - External API calls
// - File operations
// These should be handled in traditional processing after XState transitions

export const mcBookingMachine = setup({
  types: {
    context: {} as MediaCommonsBookingContext,
    events: {} as
      | { type: "edit" }
      | { type: "Modify" }
      | { type: "cancel" }
      | { type: "noShow" }
      | { type: "approve" }
      | { type: "checkIn" }
      | { type: "decline"; reason?: string }
      | { type: "checkOut" }
      | { type: "approveSetup" }
      | { type: "approveStaff" }
      | { type: "declineSetup" }
      | { type: "declineStaff" }
      | { type: "closeoutSetup" }
      | { type: "closeoutStaff" }
      | { type: "approveCatering" }
      | { type: "approveCleaning" }
      | { type: "approveSecurity" }
      | { type: "declineCatering" }
      | { type: "declineCleaning" }
      | { type: "declineSecurity" }
      | { type: "approveEquipment" }
      | { type: "closeoutCatering" }
      | { type: "closeoutCleaning" }
      | { type: "closeoutSecurity" }
      | { type: "declineEquipment" }
      | { type: "closeoutEquipment" }
      | { type: "autoCloseScript" },
  },
  actors: {},
  actions: {
    // Cancel processing is now handled by db.ts after XState transition
    // to keep the same pattern across all tenants (MC, ITP, etc.)
    handleCancelProcessing: ({ context }) => {
      console.log("🎬 XSTATE ACTION: handleCancelProcessing (no-op, handled by db.ts)", {
        calendarEventId: context.calendarEventId,
        tenant: context.tenant,
      });
    },

    sendHTMLEmail: ({ context, event }) => {
      // NOTE: This is a placeholder action for state machine logic only
      // Actual email sending is handled by traditional processing after XState
      console.log(
        "📧 XSTATE ACTION: sendHTMLEmail executed (placeholder only)",
        {
          tenant: context.tenant,
          hasFormData: !!context.formData,
          email: context.email,
          note: "Actual email sending handled outside XState",
        },
      );
    },
    createCalendarEvent: ({ context, event }) => {
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
    updateCalendarEvent: ({ context, event }) => {
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
    deleteCalendarEvent: ({ context, event }) => {
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
      { context, event },
      params: { status?: string; note?: string } = {},
    ) => {
      // Log booking history directly from XState
      try {
        const { logServerBookingChange, serverGetDataByCalendarEventId } =
          await import("@/lib/firebase/server/adminDb");
        const { TableNames } = await import("@/components/src/policy");
        const { BookingStatusLabel } = await import("@/components/src/types");

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

        await logServerBookingChange({
          bookingId: bookingDoc.id,
          calendarEventId: context.calendarEventId,
          status: status as any, // Type assertion for dynamic import
          changedBy: context.email || "system",
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
    inviteUserToCalendarEvent: ({ context, event }) => {
      console.log("👥 XSTATE ACTION: inviteUserToCalendarEvent executed", {
        tenant: context.tenant,
        calendarEventId: context.calendarEventId,
        email: context.email,
      });
    },
    setDeclineReason: assign({
      declineReason: ({ event }) => {
        const { reason } = event as any;
        if (reason && reason.trim()) {
          return reason;
        }
        return "Service requirements could not be fulfilled";
      },
    }),
    logCanceledAfterAutomaticTransition: async (
      { context },
    ): Promise<void> => {
      await logAutomaticCancellationTransition(context);
    },
    // Service approval/decline actions generated from config
    ...createServiceActions(SERVICE_CONFIGS),
    // Auto-approve all requested services for pregame bookings
    approveAllPregameServices: assign({
      servicesApproved: ({ context }) => {
        const approved: any = {};
        if (context.servicesRequested) {
          Object.keys(context.servicesRequested).forEach((service) => {
            if (
              context.servicesRequested?.[
              service as keyof typeof context.servicesRequested
              ]
            ) {
              approved[service] = true;
            }
          });
        }
        console.log(
          `✅ AUTO-APPROVING ALL PREGAME SERVICES [${context.tenant?.toUpperCase()}]:`,
          {
            servicesRequested: context.servicesRequested,
            servicesApproved: approved,
            origin: context.origin,
          },
        );
        return approved;
      },
    }),

    // Close processing is now handled by callers (db.ts, cron, /api/services) after XState transition
    // to keep the same pattern across all tenants (MC, ITP, etc.)
    handleCloseProcessing: ({ context }) => {
      console.log("🎬 XSTATE ACTION: handleCloseProcessing (no-op, handled by callers)", {
        calendarEventId: context.calendarEventId,
        tenant: context.tenant,
      });
    },

    // Checkout processing is now handled by db.ts after XState transition
    // to keep the same pattern across all tenants (MC, ITP, etc.)
    handleCheckoutProcessing: ({ context }) => {
      console.log("🎬 XSTATE ACTION: handleCheckoutProcessing (no-op, handled by db.ts)", {
        calendarEventId: context.calendarEventId,
        tenant: context.tenant,
      });
    },

  },
  guards: {
    shouldAutoApprove: ({ context }) => {
      // If this is a newly created XState (converted from existing booking without XState data), don't auto-approve
      // This prevents auto-approval when converting existing bookings to XState
      if (context._restoredFromStatus) {
        console.log(
          "🚫 XSTATE GUARD: Newly created XState from existing booking (no prior xstateData), requires manual approval",
        );
        console.log(
          "🎯 XSTATE AUTO-APPROVAL GUARD RESULT: REJECTED (Converted from existing booking)",
        );
        return false;
      }

      // Implement actual auto-approval logic for Media Commons
      if (context.tenant !== TENANTS.MC) {
        console.log(
          `🚫 XSTATE GUARD: Not Media Commons tenant (${context.tenant}), rejecting auto-approval`,
        );
        console.log(
          "🎯 XSTATE AUTO-APPROVAL GUARD RESULT: REJECTED (Wrong tenant)",
        );
        return false;
      }

      // Check event duration against role-based limits
      if (context.bookingCalendarInfo && context.selectedRooms) {
        const startDate = new Date(context.bookingCalendarInfo.startStr);
        const endDate = new Date(context.bookingCalendarInfo.endStr);
        const duration = endDate.getTime() - startDate.getTime();
        const durationHours = duration / ONE_HOUR_IN_MS;

        // Get dynamic hour limits based on role and booking type
        const { maxHours, minHours } = getBookingHourLimits(
          context.selectedRooms,
          context.role,
          context.isWalkIn || false,
          context.isVip || false,
        );

        if (durationHours > maxHours) {
          console.log(
            `🚫 XSTATE GUARD: Event duration exceeds maximum (${durationHours.toFixed(1)} hours > ${maxHours} hours max for ${context.role || "student"} ${context.isVip ? "VIP" : context.isWalkIn ? "walk-in" : "booking"})`,
          );
          console.log(
            "🎯 XSTATE AUTO-APPROVAL GUARD RESULT: REJECTED (Duration exceeds max limit)",
          );
          return false;
        }

        if (durationHours < minHours) {
          console.log(
            `🚫 XSTATE GUARD: Event duration below minimum (${durationHours.toFixed(1)} hours < ${minHours} hours min for ${context.role || "student"} ${context.isVip ? "VIP" : context.isWalkIn ? "walk-in" : "booking"})`,
          );
          console.log(
            "🎯 XSTATE AUTO-APPROVAL GUARD RESULT: REJECTED (Duration below min limit)",
          );
          return false;
        }
      }

      // Check if any services are requested - if so, don't auto-approve (except for walk-ins)
      if (
        context.servicesRequested &&
        typeof context.servicesRequested === "object" &&
        !context.isWalkIn
      ) {
        const hasServices = Object.values(context.servicesRequested).some(
          Boolean,
        );
        if (hasServices) {
          console.log(
            "🚫 XSTATE GUARD: Services requested, requires manual approval",
          );
          console.log(
            "🎯 XSTATE AUTO-APPROVAL GUARD RESULT: REJECTED (Services requested)",
          );
          return false;
        }
      }

      // Room eligibility and all other auto-approval rules are handled by checkAutoApprovalEligibility below
      // (no longer using legacy room.shouldAutoApprove)

      // Special case: VIP bookings with services should go to "Services Request" state, not auto-approve
      if (context.isVip) {
        const hasServices =
          context.servicesRequested &&
            typeof context.servicesRequested === "object"
            ? Object.values(context.servicesRequested).some(Boolean)
            : false;

        if (hasServices) {
          console.log(
            "🚫 XSTATE GUARD: VIP booking with services should go to Services Request, not auto-approve",
          );
          console.log(
            "🎯 XSTATE AUTO-APPROVAL GUARD RESULT: REJECTED (VIP with services)",
          );
          return false;
        }
      }

      // Calculate duration if calendar info is available
      let durationHours: number | undefined;
      if (context.bookingCalendarInfo) {
        const startDate = new Date(context.bookingCalendarInfo.startStr);
        const endDate = new Date(context.bookingCalendarInfo.endStr);
        const duration = endDate.getTime() - startDate.getTime();
        durationHours = duration / ONE_HOUR_IN_MS;
      }

      // Map servicesRequested to format expected by autoApprovalUtils
      const servicesRequested = context.servicesRequested
        ? {
          setup: context.servicesRequested.setup || false,
          equipment: context.servicesRequested.equipment || false,
          staffing: context.servicesRequested.staff || false,
          catering: context.servicesRequested.catering || false,
          cleaning: context.servicesRequested.cleaning || false,
          security: context.servicesRequested.security || false,
        }
        : undefined;

      // Use the new auto-approval utility
      const result = checkAutoApprovalEligibility({
        selectedRooms: context.selectedRooms || [],
        role: context.role,
        isWalkIn: context.isWalkIn,
        isVip: context.isVip,
        durationHours,
        servicesRequested,
      });

      if (result.canAutoApprove) {
        console.log("✅ XSTATE GUARD: All conditions met for auto-approval");
        console.log("🎯 XSTATE AUTO-APPROVAL GUARD RESULT: APPROVED", {
          isWalkIn: context.isWalkIn,
          isVip: context.isVip,
          reason: result.reason,
          details: result.details,
        });
      } else {
        console.log(`🚫 XSTATE GUARD: ${result.reason}`);
        console.log("🎯 XSTATE AUTO-APPROVAL GUARD RESULT: REJECTED", {
          reason: result.reason,
          details: result.details,
        });
      }

      return result.canAutoApprove;
    },
    "isVip AND servicesRequested": and([
      ({ context }) => {
        const isVip = context.isVip || false;
        console.log(`🎯 XSTATE GUARD: Checking isVip: ${isVip}`);
        return isVip;
      },
      ({ context }) => {
        const hasServices =
          context.servicesRequested &&
            typeof context.servicesRequested === "object"
            ? Object.values(context.servicesRequested).some(Boolean)
            : false;
        console.log(
          `🎯 XSTATE GUARD: Checking servicesRequested: ${hasServices}`,
        );
        return hasServices;
      },
    ]),
    servicesRequested: ({ context }) => {
      const hasServices =
        context.servicesRequested &&
          typeof context.servicesRequested === "object"
          ? Object.values(context.servicesRequested).some(Boolean)
          : false;
      console.log(`🎯 XSTATE GUARD: servicesRequested: ${hasServices}`);
      return hasServices;
    },
    servicesApproved: ({ context }) => {
      if (
        !context.servicesRequested ||
        typeof context.servicesRequested !== "object"
      )
        return false;

      // Check if any services are actually requested
      const hasRequestedServices = Object.values(
        context.servicesRequested,
      ).some(Boolean);

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
    servicesDeclined: ({ context }) => {
      if (
        !context.servicesRequested ||
        typeof context.servicesRequested !== "object" ||
        !context.servicesApproved ||
        typeof context.servicesApproved !== "object"
      )
        return false;

      // First, check if ALL requested services have been decided (approved or declined)
      const allServicesDecided = Object.entries(
        context.servicesRequested,
      ).every(([service, requested]) => {
        if (!requested) return true; // If not requested, it's considered "decided"
        const approval =
          context.servicesApproved?.[
          service as keyof typeof context.servicesApproved
          ];
        return typeof approval === "boolean"; // Must be explicitly true or false
      });

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
    // Per-service requested/approved guards generated from config
    ...createServiceGuards(SERVICE_CONFIGS),
    isPregameOrigin: ({ context }) => {
      const isPregame = context.origin === BookingOrigin.PREGAME;
      console.log(`🎯 XSTATE GUARD: isPregameOrigin: ${isPregame}`, {
        origin: context.origin,
      });
      return isPregame;
    },
  },
}).createMachine({
  context: ({ input }: { input?: MediaCommonsBookingContext }) => ({
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
  }),
  id: "MC Booking Request",
  initial: "Requested",
  states: {
    Requested: {
      on: {
        cancel: {
          target: "Canceled",
        },
        decline: {
          target: "Declined",
        },
        edit: {
          target: "Requested",
        },
        approve: {
          target: "Pre-approved",
        },
      },
      always: [
        {
          target: "Approved",
          guard: {
            type: "shouldAutoApprove",
          },
        },
        {
          target: "Services Request",
          guard: {
            type: "isVip AND servicesRequested",
          },
        },
      ],
      entry: [
        ({ context }) => {
          console.log(
            "🏁 XSTATE STATE: Entered 'Requested' state [MEDIA COMMONS]",
            {
              tenant: context.tenant,
              timestamp: new Date().toISOString(),
              isVip: context.isVip,
              servicesRequested: context.servicesRequested,
              calendarEventId: context.calendarEventId,
            },
          );
        },
        {
          type: "sendHTMLEmail",
        },
        {
          type: "createCalendarEvent",
        },
      ],
    },
    Canceled: {
      always: [
        {
          target: "Service Closeout",
          guard: {
            type: "servicesRequested",
          },
        },
        {
          target: "Closed",
        },
      ],
      entry: [
        ({ context }) => {
          console.log(
            "🏁 XSTATE STATE: Entered 'Canceled' state [MEDIA COMMONS]",
            {
              tenant: context.tenant,
              timestamp: new Date().toISOString(),
              servicesRequested: context.servicesRequested,
              calendarEventId: context.calendarEventId,
            },
          );
        },
        {
          type: "handleCancelProcessing",
        },
        {
          type: "logCanceledAfterAutomaticTransition",
        },
      ],
    },
    Declined: {
      on: {
        cancel: {
          target: "Canceled",
        },
        edit: {
          target: "Requested",
        },
      },
      after: {
        "86400000": {
          target: "Canceled",
          actions: [assign({ automationReason: "decline" as const })],
        },
      },
      entry: [
        ({ context }) => {
          console.log("🏁 XSTATE STATE: Entered 'Declined' state", {
            tenant: context.tenant,
            timestamp: new Date().toISOString(),
          });
        },
        {
          type: "sendHTMLEmail",
        },
        {
          type: "updateCalendarEvent",
        },
      ],
    },
    Approved: {
      on: {
        checkIn: {
          target: "Checked In",
        },
        cancel: {
          target: "Canceled",
        },
        decline: {
          target: "Declined",
        },
        noShow: {
          target: "No Show",
        },
        autoCloseScript: {
          target: "Closed",
        },
        Modify: {
          target: "Approved",
        },
      },
      entry: [
        ({ context }) => {
          console.log("🏁 XSTATE STATE: Entered 'Approved' state", {
            tenant: context.tenant,
            timestamp: new Date().toISOString(),
          });
          console.log("🎉 XSTATE: APPROVAL SUCCESSFUL!");
        },
        {
          type: "sendHTMLEmail",
        },
        {
          type: "updateCalendarEvent",
        },
        {
          type: "inviteUserToCalendarEvent",
        },
      ],
    },
    "Services Request": {
      type: "parallel",
      on: {
        cancel: {
          target: "Canceled",
        },
      },
      onDone: {
        target: "Evaluate Services Request",
      },
      entry: [
        ({ context }) => {
          console.log(
            "🏁 XSTATE STATE: Entered 'Services Request' parallel state [MEDIA COMMONS]",
            {
              tenant: context.tenant,
              timestamp: new Date().toISOString(),
              servicesRequested: context.servicesRequested,
              isVip: context.isVip,
            },
          );
        },
      ],
      states: Object.fromEntries(
        SERVICE_CONFIGS.map(c => [`${c.name} Request`, createServiceRequestState(c)])
      ) as any,
    },
    "Pre-approved": {
      on: {
        approve: [
          {
            target: "Approved",
            guard: {
              type: "isPregameOrigin",
            },
            actions: "approveAllPregameServices",
          },
          {
            target: "Approved",
            guard: {
              type: "servicesApproved",
            },
          },
          {
            target: "Services Request",
            guard: {
              type: "servicesRequested",
            },
          },
          {
            target: "Approved",
          },
        ],
        cancel: {
          target: "Canceled",
        },
        decline: {
          target: "Declined",
          actions: "setDeclineReason",
        },
        edit: {
          target: "Requested",
        },
      },
      entry: [
        ({ context }) => {
          console.log("🏁 XSTATE STATE: Entered 'Pre-approved' state", {
            tenant: context.tenant,
            timestamp: new Date().toISOString(),
            origin: context.origin,
            isPregame: context.origin === BookingOrigin.PREGAME,
          });
        },
        {
          type: "updateCalendarEvent",
        },
      ],
    },
    "Service Closeout": {
      type: "parallel",
      onDone: {
        target: "Closed",
      },
      entry: [
        ({ context }) => {
          console.log(
            "🏁 XSTATE STATE: Entered 'Service Closeout' parallel state [MEDIA COMMONS]",
            {
              tenant: context.tenant,
              timestamp: new Date().toISOString(),
              servicesApproved: context.servicesApproved,
            },
          );
        },
      ],
      states: Object.fromEntries(
        SERVICE_CONFIGS.map(c => [`${c.name} Closeout`, createServiceCloseoutState(c)])
      ) as any,
    },
    Closed: {
      type: "final",
      entry: [
        ({ context }) => {
          console.log("🏁 XSTATE STATE: Entered 'Closed' state (final)", {
            tenant: context.tenant,
            timestamp: new Date().toISOString(),
          });
        },
        {
          type: "handleCloseProcessing",
        },
        {
          type: "sendHTMLEmail",
        },
        {
          type: "updateCalendarEvent",
        },
      ],
    },
    "Checked In": {
      on: {
        checkOut: {
          target: "Checked Out",
        },
      },
      entry: [
        ({ context }) => {
          console.log("🏁 XSTATE STATE: Entered 'Checked In' state", {
            tenant: context.tenant,
            timestamp: new Date().toISOString(),
          });
        },
        {
          type: "sendHTMLEmail",
        },
        {
          type: "updateCalendarEvent",
        },
      ],
    },
    "No Show": {
      always: {
        target: "Canceled",
        actions: [assign({ automationReason: "no-show" })],
      },
      entry: [
        ({ context }) => {
          console.log("🏁 XSTATE STATE: Entered 'No Show' state", {
            tenant: context.tenant,
            timestamp: new Date().toISOString(),
          });
        },
        {
          type: "updateCalendarEvent",
        },
        {
          type: "logBookingHistory",
          params: {
            status: "NO-SHOW",
            note: "Booking marked as no show",
          },
        },
      ],
    },
    "Evaluate Services Request": {
      always: [
        {
          target: "Approved",
          guard: {
            type: "servicesApproved",
          },
        },
        {
          target: "Declined",
          guard: {
            type: "servicesDeclined",
          },
        },
      ],
      entry: [
        ({ context }) => {
          console.log(
            "🔍 XSTATE STATE: Evaluating Services Request Results [MEDIA COMMONS]",
            {
              tenant: context.tenant,
              timestamp: new Date().toISOString(),
              servicesRequested: context.servicesRequested,
              servicesApproved: context.servicesApproved,
            },
          );
        },
      ],
    },
    "Checked Out": {
      always: [
        {
          target: "Service Closeout",
          guard: {
            type: "servicesRequested",
          },
        },
        {
          target: "Closed",
        },
      ],
      entry: [
        ({ context }) => {
          console.log("🏁 XSTATE STATE: Entered 'Checked Out' state", {
            tenant: context.tenant,
            timestamp: new Date().toISOString(),
          });
        },
        {
          type: "handleCheckoutProcessing",
        },
        {
          type: "sendHTMLEmail",
        },
        {
          type: "updateCalendarEvent",
        },
      ],
    },
  },
});
