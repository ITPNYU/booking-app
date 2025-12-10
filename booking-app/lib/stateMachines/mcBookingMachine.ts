import { TENANTS } from "@/components/src/constants/tenants";
import { BookingLogger } from "@/lib/logger/bookingLogger";
import { and, assign, setup } from "xstate";
import { Role } from "@/components/src/types";
import { checkAutoApprovalEligibility } from "@/lib/utils/autoApprovalUtils";

// Time constants for clarity
const ONE_HOUR_IN_MS = 60 * 60 * 1000;

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
    handleCancelProcessing: async ({ context, event }) => {
      console.log(`🎬 XSTATE ACTION: handleCancelProcessing started`, {
        calendarEventId: context.calendarEventId,
        tenant: context.tenant,
        email: context.email,
      });

      try {
        const calendarEventId = context.calendarEventId;
        const email = context.email || "system";
        const netId = email?.split("@")[0] || "system";
        const tenant = context.tenant;

        if (calendarEventId) {
          console.log(`🎬 XSTATE ACTION: About to call cancel processing API`, {
            calendarEventId,
            email,
            netId,
            tenant,
          });

          // Call the cancel processing API
          const response = await fetch(
            `${process.env.NEXT_PUBLIC_BASE_URL}/api/cancel-processing`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "x-tenant": tenant || "mc",
              },
              body: JSON.stringify({
                calendarEventId,
                email,
                netId,
                tenant,
              }),
            }
          );

          if (response.ok) {
            const result = await response.json();
            console.log(
              `✅ CANCEL PROCESSING API SUCCESS [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
              {
                calendarEventId,
                result,
              }
            );
          } else {
            const errorText = await response.text();
            console.error(
              `🚨 CANCEL PROCESSING API FAILED [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
              {
                calendarEventId,
                status: response.status,
                statusText: response.statusText,
                error: errorText,
              }
            );
          }
        } else {
          console.error(
            `🚨 CANCEL PROCESSING API SKIPPED - NO CALENDAR EVENT ID [${tenant?.toUpperCase() || "UNKNOWN"}]`
          );
        }
      } catch (error: any) {
        console.error(
          `🚨 XSTATE CANCEL PROCESSING ERROR [${context.tenant?.toUpperCase() || "UNKNOWN"}]:`,
          {
            calendarEventId: context.calendarEventId,
            error: error.message,
            stack: error.stack,
          }
        );
      }

      console.log(`🎬 XSTATE ACTION: handleCancelProcessing completed`);
    },

    sendHTMLEmail: ({ context, event }) => {
      // NOTE: This is a placeholder action for state machine logic only
      // Actual email sending is handled by traditional processing after XState
      console.log(
        `📧 XSTATE ACTION: sendHTMLEmail executed (placeholder only)`,
        {
          tenant: context.tenant,
          hasFormData: !!context.formData,
          email: context.email,
          note: "Actual email sending handled outside XState",
        }
      );
    },
    createCalendarEvent: ({ context, event }) => {
      // NOTE: This is a placeholder action for state machine logic only
      // Actual calendar creation is handled by traditional processing after XState
      console.log(
        `📅 XSTATE ACTION: createCalendarEvent executed (placeholder only)`,
        {
          tenant: context.tenant,
          selectedRoomsCount: context.selectedRooms?.length || 0,
          calendarEventId: context.calendarEventId,
          note: "Actual calendar creation handled outside XState",
        }
      );
    },
    updateCalendarEvent: ({ context, event }) => {
      // NOTE: This is a placeholder action for state machine logic only
      // Actual calendar update is handled by traditional processing after XState
      console.log(
        `📅 XSTATE ACTION: updateCalendarEvent executed (placeholder only)`,
        {
          tenant: context.tenant,
          calendarEventId: context.calendarEventId,
          note: "Actual calendar update handled outside XState",
        }
      );
    },
    deleteCalendarEvent: ({ context, event }) => {
      // NOTE: This is a placeholder action for state machine logic only
      // Actual calendar deletion is handled by traditional processing after XState
      console.log(
        `🗑️ XSTATE ACTION: deleteCalendarEvent executed (placeholder only)`,
        {
          tenant: context.tenant,
          calendarEventId: context.calendarEventId,
          note: "Actual calendar deletion handled outside XState",
        }
      );
    },
    logBookingHistory: async (
      { context, event },
      params: { status?: string; note?: string } = {}
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
            { calendarEventId: context.calendarEventId }
          );
          return;
        }

        // Get booking document to get bookingId and requestNumber
        const bookingDoc = await serverGetDataByCalendarEventId(
          TableNames.BOOKING,
          context.calendarEventId,
          context.tenant
        );

        if (!bookingDoc) {
          console.error(
            `❌ XSTATE HISTORY LOG: Booking not found [${context.tenant?.toUpperCase()}]`,
            { calendarEventId: context.calendarEventId }
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
          }
        );
      } catch (error) {
        console.error(
          `🚨 XSTATE HISTORY LOG FAILED [${context.tenant?.toUpperCase() || "UNKNOWN"}]:`,
          {
            calendarEventId: context.calendarEventId,
            error: error.message,
          }
        );
      }
    },
    inviteUserToCalendarEvent: ({ context, event }) => {
      console.log(`👥 XSTATE ACTION: inviteUserToCalendarEvent executed`, {
        tenant: context.tenant,
        calendarEventId: context.calendarEventId,
        email: context.email,
      });
    },
    setDeclineReason: assign({
      declineReason: ({ event }) => {
        const reason = (event as any).reason;
        if (reason && reason.trim()) {
          return reason;
        }
        return "Service requirements could not be fulfilled";
      },
    }),
    // Service approval actions that update context
    approveStaffService: assign({
      servicesApproved: ({ context }) => ({
        ...context.servicesApproved,
        staff: true,
      }),
    }),
    approveEquipmentService: assign({
      servicesApproved: ({ context }) => ({
        ...context.servicesApproved,
        equipment: true,
      }),
    }),
    approveCateringService: assign({
      servicesApproved: ({ context }) => ({
        ...context.servicesApproved,
        catering: true,
      }),
    }),
    approveCleaningService: assign({
      servicesApproved: ({ context }) => ({
        ...context.servicesApproved,
        cleaning: true,
      }),
    }),
    approveSecurityService: assign({
      servicesApproved: ({ context }) => ({
        ...context.servicesApproved,
        security: true,
      }),
    }),
    approveSetupService: assign({
      servicesApproved: ({ context }) => ({
        ...context.servicesApproved,
        setup: true,
      }),
    }),

    handleCloseProcessing: async ({ context, event }) => {
      console.log(`🎬 XSTATE ACTOR: handleCloseProcessing started`, {
        input: {
          context: {
            tenant: context.tenant,
            calendarEventId: context.calendarEventId,
            email: context.email,
          },
        },
      });

      try {
        const calendarEventId = context.calendarEventId;
        const email = context.email || "system";
        const tenant = context.tenant;

        if (calendarEventId) {
          // Add delay to allow service closeout processing to complete first
          // This ensures proper order: Service Closeout → Close Processing
          console.log(
            `⏳ WAITING FOR SERVICE CLOSEOUT COMPLETION [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
            {
              calendarEventId,
              delay: "500ms",
            }
          );

          await new Promise((resolve) => setTimeout(resolve, 500));

          console.log(`🎬 XSTATE ACTOR: About to call close processing API`, {
            calendarEventId,
            email,
            tenant,
          });

          // Call the close processing API
          const response = await fetch(
            `${process.env.NEXT_PUBLIC_BASE_URL}/api/close-processing`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "x-tenant": tenant || "mc",
              },
              body: JSON.stringify({
                calendarEventId,
                email,
                tenant,
              }),
            }
          );

          if (response.ok) {
            const result = await response.json();
            console.log(
              `✅ CLOSE PROCESSING API SUCCESS [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
              {
                calendarEventId,
                result,
              }
            );
          } else {
            const errorText = await response.text();
            console.error(
              `🚨 CLOSE PROCESSING API FAILED [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
              {
                calendarEventId,
                status: response.status,
                statusText: response.statusText,
                error: errorText,
              }
            );
          }
        } else {
          console.error(
            `🚨 CLOSE PROCESSING API SKIPPED - NO CALENDAR EVENT ID [${tenant?.toUpperCase() || "UNKNOWN"}]`
          );
        }
      } catch (error: any) {
        console.error(
          `🚨 CLOSE PROCESSING API ERROR [${context.tenant?.toUpperCase() || "UNKNOWN"}]:`,
          {
            error: error.message,
            stack: error.stack,
          }
        );
      }

      console.log(`🎬 XSTATE ACTOR: handleCloseProcessing completed`);
    },

    handleCheckoutProcessing: async ({ context, event }) => {
      BookingLogger.xstateActorStarted("handleCheckoutProcessing", {
        calendarEventId: context.calendarEventId,
        tenant: context.tenant,
        email: context.email,
      });

      try {
        const calendarEventId = context.calendarEventId;
        // Prioritize email from event (for cronjob auto-checkout), fallback to context email
        const email = (event as any)?.email || context.email || "system";
        const tenant = context.tenant;

        if (calendarEventId) {
          BookingLogger.apiRequest("POST", "/api/checkout-processing", {
            calendarEventId,
            email,
            tenant,
          });

          // Call the checkout processing API
          const response = await fetch(
            `${process.env.NEXT_PUBLIC_BASE_URL}/api/checkout-processing`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "x-tenant": tenant || "mc",
              },
              body: JSON.stringify({
                calendarEventId,
                email,
                tenant,
              }),
            }
          );

          if (response.ok) {
            const result = await response.json();
            BookingLogger.apiSuccess(
              "POST",
              "/api/checkout-processing",
              {
                calendarEventId,
                tenant,
              },
              result
            );
          } else {
            const errorText = await response.text();
            BookingLogger.apiError(
              "POST",
              "/api/checkout-processing",
              {
                calendarEventId,
                tenant,
              },
              {
                message: errorText,
                status: response.status,
              }
            );
          }
        } else {
          BookingLogger.warning(
            "Checkout processing API skipped - no calendar event ID",
            { tenant }
          );
        }
      } catch (error: any) {
        BookingLogger.xstateError(
          "Checkout processing API error",
          { calendarEventId: context.calendarEventId, tenant: context.tenant },
          error
        );
      }

      BookingLogger.xstateActorCompleted("handleCheckoutProcessing", {
        calendarEventId: context.calendarEventId,
        tenant: context.tenant,
      });
    },

    // Service decline actions that update context
    declineStaffService: assign({
      servicesApproved: ({ context }) => ({
        ...context.servicesApproved,
        staff: false,
      }),
    }),
    declineEquipmentService: assign({
      servicesApproved: ({ context }) => ({
        ...context.servicesApproved,
        equipment: false,
      }),
    }),
    declineCateringService: assign({
      servicesApproved: ({ context }) => ({
        ...context.servicesApproved,
        catering: false,
      }),
    }),
    declineCleaningService: assign({
      servicesApproved: ({ context }) => ({
        ...context.servicesApproved,
        cleaning: false,
      }),
    }),
    declineSecurityService: assign({
      servicesApproved: ({ context }) => ({
        ...context.servicesApproved,
        security: false,
      }),
    }),
    declineSetupService: assign({
      servicesApproved: ({ context }) => ({
        ...context.servicesApproved,
        setup: false,
      }),
    }),
  },
  guards: {
    shouldAutoApprove: ({ context }) => {
      console.log(
        `🎯 XSTATE AUTO-APPROVAL GUARD STARTED [${context.tenant?.toUpperCase() || "UNKNOWN"}]:`,
        {
          context,
          tenant: context.tenant,
          selectedRooms: context.selectedRooms?.length || 0,
          formData: context.formData,
          bookingDuration: context.bookingCalendarInfo
            ? `${((new Date(context.bookingCalendarInfo.endStr).getTime() - new Date(context.bookingCalendarInfo.startStr).getTime()) / (1000 * 60 * 60)).toFixed(1)} hours`
            : "Not set",
          isWalkIn: context.isWalkIn,
          isVip: context.isVip,
        }
      );

      // If this is a newly created XState (converted from existing booking without XState data), don't auto-approve
      // This prevents auto-approval when converting existing bookings to XState
      if (context._restoredFromStatus) {
        console.log(
          `🚫 XSTATE GUARD: Newly created XState from existing booking (no prior xstateData), requires manual approval`
        );
        console.log(
          `🎯 XSTATE AUTO-APPROVAL GUARD RESULT: REJECTED (Converted from existing booking)`
        );
        return false;
      }

      // Implement actual auto-approval logic for Media Commons
      if (context.tenant !== TENANTS.MC) {
        console.log(
          `🚫 XSTATE GUARD: Not Media Commons tenant (${context.tenant}), rejecting auto-approval`
        );
        console.log(
          `🎯 XSTATE AUTO-APPROVAL GUARD RESULT: REJECTED (Wrong tenant)`
        );
        return false;
      }

      // Special case: VIP bookings with services should go to "Services Request" state, not auto-approve
      // This allows the "isVip AND servicesRequested" guard to catch them
      if (context.isVip) {
        const hasServices =
          context.servicesRequested &&
          typeof context.servicesRequested === "object"
            ? Object.values(context.servicesRequested).some(Boolean)
            : false;
        
        if (hasServices) {
          console.log(
            `🚫 XSTATE GUARD: VIP booking with services should go to Services Request, not auto-approve`
          );
          console.log(
            `🎯 XSTATE AUTO-APPROVAL GUARD RESULT: REJECTED (VIP with services)`
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
        console.log(`✅ XSTATE GUARD: All conditions met for auto-approval`);
        console.log(`🎯 XSTATE AUTO-APPROVAL GUARD RESULT: APPROVED`, {
          isWalkIn: context.isWalkIn,
          isVip: context.isVip,
          reason: result.reason,
          details: result.details,
        });
      } else {
        console.log(`🚫 XSTATE GUARD: ${result.reason}`);
        console.log(`🎯 XSTATE AUTO-APPROVAL GUARD RESULT: REJECTED`, {
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
          `🎯 XSTATE GUARD: Checking servicesRequested: ${hasServices}`
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
        context.servicesRequested
      ).some(Boolean);

      // If no services are requested, consider all "approved"
      if (!hasRequestedServices) {
        console.log(
          `🎯 XSTATE GUARD: servicesApproved: true (no services requested)`
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
        }
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
        context.servicesRequested
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
          `🎯 XSTATE GUARD: servicesDeclined: false (not all services decided yet)`
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
        }
      );

      console.log(
        `🎯 XSTATE GUARD: servicesDeclined: ${anyDeclined} (all services decided: ${allServicesDecided})`
      );
      return anyDeclined;
    },
    staffRequested: ({ context }) => {
      const requested = context.servicesRequested?.staff || false;
      console.log(`🎯 XSTATE GUARD: staffRequested: ${requested}`);
      return requested;
    },
    equipRequested: ({ context }) => {
      const requested = context.servicesRequested?.equipment || false;
      console.log(`🎯 XSTATE GUARD: equipRequested: ${requested}`);
      return requested;
    },
    caterRequested: ({ context }) => {
      const requested = context.servicesRequested?.catering || false;
      console.log(`🎯 XSTATE GUARD: caterRequested: ${requested}`);
      return requested;
    },
    cleanRequested: ({ context }) => {
      const requested = context.servicesRequested?.cleaning || false;
      console.log(`🎯 XSTATE GUARD: cleanRequested: ${requested}`);
      return requested;
    },
    securityRequested: ({ context }) => {
      const requested = context.servicesRequested?.security || false;
      console.log(`🎯 XSTATE GUARD: securityRequested: ${requested}`);
      return requested;
    },
    setupRequested: ({ context }) => {
      const requested = context.servicesRequested?.setup || false;
      console.log(`🎯 XSTATE GUARD: setupRequested: ${requested}`);
      return requested;
    },
    equipApproved: ({ context }) => {
      const approved = context.servicesApproved?.equipment === true;
      console.log(`🎯 XSTATE GUARD: equipApproved: ${approved}`);
      return approved;
    },
    staffApproved: ({ context }) => {
      const approved = context.servicesApproved?.staff === true;
      console.log(`🎯 XSTATE GUARD: staffApproved: ${approved}`);
      return approved;
    },
    setupApproved: ({ context }) => {
      const approved = context.servicesApproved?.setup === true;
      console.log(`🎯 XSTATE GUARD: setupApproved: ${approved}`);
      return approved;
    },
    cleanApproved: ({ context }) => {
      const approved = context.servicesApproved?.cleaning === true;
      console.log(`🎯 XSTATE GUARD: cleanApproved: ${approved}`);
      return approved;
    },
    cateringApproved: ({ context }) => {
      const approved = context.servicesApproved?.catering === true;
      console.log(`🎯 XSTATE GUARD: cateringApproved: ${approved}`);
      return approved;
    },
    securityApproved: ({ context }) => {
      const approved = context.servicesApproved?.security === true;
      console.log(`🎯 XSTATE GUARD: securityApproved: ${approved}`);
      return approved;
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
            `🏁 XSTATE STATE: Entered 'Requested' state [MEDIA COMMONS]`,
            {
              tenant: context.tenant,
              timestamp: new Date().toISOString(),
              isVip: context.isVip,
              servicesRequested: context.servicesRequested,
              calendarEventId: context.calendarEventId,
            }
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
            `🏁 XSTATE STATE: Entered 'Canceled' state [MEDIA COMMONS]`,
            {
              tenant: context.tenant,
              timestamp: new Date().toISOString(),
              servicesRequested: context.servicesRequested,
              calendarEventId: context.calendarEventId,
            }
          );
        },
        {
          type: "handleCancelProcessing",
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
        "86400000": [
          {
            target: "Service Closeout",
            guard: {
              type: "servicesRequested",
            },
          },
          {
            target: "Canceled",
          },
        ],
      },
      entry: [
        ({ context }) => {
          console.log(`🏁 XSTATE STATE: Entered 'Declined' state`, {
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
          console.log(`🏁 XSTATE STATE: Entered 'Approved' state`, {
            tenant: context.tenant,
            timestamp: new Date().toISOString(),
          });
          console.log(`🎉 XSTATE: APPROVAL SUCCESSFUL!`);
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
            `🏁 XSTATE STATE: Entered 'Services Request' parallel state [MEDIA COMMONS]`,
            {
              tenant: context.tenant,
              timestamp: new Date().toISOString(),
              servicesRequested: context.servicesRequested,
              isVip: context.isVip,
            }
          );
        },
      ],
      states: {
        "Staff Request": {
          initial: "Evaluate Staff Request",
          states: {
            "Evaluate Staff Request": {
              always: [
                {
                  target: "Staff Requested",
                  guard: {
                    type: "staffRequested",
                  },
                },
                {
                  target: "Staff Approved",
                },
              ],
              entry: [
                ({ context }) => {
                  console.log(
                    `🔍 XSTATE SUBSTATE: Evaluating Staff Request [MEDIA COMMONS]`,
                    {
                      tenant: context.tenant,
                      staffRequested: context.servicesRequested?.staff,
                      timestamp: new Date().toISOString(),
                    }
                  );
                },
              ],
            },
            "Staff Requested": {
              on: {
                declineStaff: {
                  target: "Staff Declined",
                  actions: "declineStaffService",
                },
                approveStaff: {
                  target: "Staff Approved",
                  actions: "approveStaffService",
                },
              },
              entry: [
                ({ context }) => {
                  console.log(
                    `⏳ XSTATE SUBSTATE: Staff Request Pending Approval [MEDIA COMMONS]`,
                    {
                      tenant: context.tenant,
                      timestamp: new Date().toISOString(),
                    }
                  );
                },
              ],
            },
            "Staff Approved": {
              type: "final",
              entry: [
                ({ context }) => {
                  console.log(
                    `✅ XSTATE SUBSTATE: Staff Request APPROVED [MEDIA COMMONS]`,
                    {
                      tenant: context.tenant,
                      timestamp: new Date().toISOString(),
                    }
                  );
                },
              ],
            },
            "Staff Declined": {
              type: "final",
              entry: [
                ({ context }) => {
                  console.log(
                    `❌ XSTATE SUBSTATE: Staff Request DECLINED [MEDIA COMMONS]`,
                    {
                      tenant: context.tenant,
                      timestamp: new Date().toISOString(),
                    }
                  );
                },
              ],
            },
          },
        },
        "Catering Request": {
          initial: "Evaluate Catering Request",
          states: {
            "Evaluate Catering Request": {
              always: [
                {
                  target: "Catering Requested",
                  guard: {
                    type: "caterRequested",
                  },
                },
                {
                  target: "Catering Approved",
                },
              ],
              entry: [
                ({ context }) => {
                  console.log(
                    `🔍 XSTATE SUBSTATE: Evaluating Catering Request [MEDIA COMMONS]`,
                    {
                      tenant: context.tenant,
                      cateringRequested: context.servicesRequested?.catering,
                      timestamp: new Date().toISOString(),
                    }
                  );
                },
              ],
            },
            "Catering Requested": {
              on: {
                approveCatering: {
                  target: "Catering Approved",
                  actions: "approveCateringService",
                },
                declineCatering: {
                  target: "Catering Declined",
                  actions: "declineCateringService",
                },
              },
              entry: [
                ({ context }) => {
                  console.log(
                    `⏳ XSTATE SUBSTATE: Catering Request Pending Approval [MEDIA COMMONS]`,
                    {
                      tenant: context.tenant,
                      timestamp: new Date().toISOString(),
                    }
                  );
                },
              ],
            },
            "Catering Approved": {
              type: "final",
              entry: [
                ({ context }) => {
                  console.log(
                    `✅ XSTATE SUBSTATE: Catering Request APPROVED [MEDIA COMMONS]`,
                    {
                      tenant: context.tenant,
                      timestamp: new Date().toISOString(),
                    }
                  );
                },
              ],
            },
            "Catering Declined": {
              type: "final",
              entry: [
                ({ context }) => {
                  console.log(
                    `❌ XSTATE SUBSTATE: Catering Request DECLINED [MEDIA COMMONS]`,
                    {
                      tenant: context.tenant,
                      timestamp: new Date().toISOString(),
                    }
                  );
                },
              ],
            },
          },
        },
        "Setup Request": {
          initial: "Evaluate Setup Request",
          states: {
            "Evaluate Setup Request": {
              always: [
                {
                  target: "Setup Requested",
                  guard: {
                    type: "setupRequested",
                  },
                },
                {
                  target: "Setup Approved",
                },
              ],
              entry: [
                ({ context }) => {
                  console.log(
                    `🔍 XSTATE SUBSTATE: Evaluating Setup Request [MEDIA COMMONS]`,
                    {
                      tenant: context.tenant,
                      setupRequested: context.servicesRequested?.setup,
                      timestamp: new Date().toISOString(),
                    }
                  );
                },
              ],
            },
            "Setup Requested": {
              on: {
                declineSetup: {
                  target: "Setup Declined",
                  actions: "declineSetupService",
                },
                approveSetup: {
                  target: "Setup Approved",
                  actions: "approveSetupService",
                },
              },
              entry: [
                ({ context }) => {
                  console.log(
                    `⏳ XSTATE SUBSTATE: Setup Request Pending Approval [MEDIA COMMONS]`,
                    {
                      tenant: context.tenant,
                      timestamp: new Date().toISOString(),
                    }
                  );
                },
              ],
            },
            "Setup Approved": {
              type: "final",
              entry: [
                ({ context }) => {
                  console.log(
                    `✅ XSTATE SUBSTATE: Setup Request APPROVED [MEDIA COMMONS]`,
                    {
                      tenant: context.tenant,
                      timestamp: new Date().toISOString(),
                    }
                  );
                },
              ],
            },
            "Setup Declined": {
              type: "final",
              entry: [
                ({ context }) => {
                  console.log(
                    `❌ XSTATE SUBSTATE: Setup Request DECLINED [MEDIA COMMONS]`,
                    {
                      tenant: context.tenant,
                      timestamp: new Date().toISOString(),
                    }
                  );
                },
              ],
            },
          },
        },
        "Cleaning Request": {
          initial: "Evaluate Cleaning Request",
          states: {
            "Evaluate Cleaning Request": {
              always: [
                {
                  target: "Cleaning Requested",
                  guard: {
                    type: "cleanRequested",
                  },
                },
                {
                  target: "Cleaning Approved",
                },
              ],
              entry: [
                ({ context }) => {
                  console.log(
                    `🔍 XSTATE SUBSTATE: Evaluating Cleaning Request [MEDIA COMMONS]`,
                    {
                      tenant: context.tenant,
                      cleaningRequested: context.servicesRequested?.cleaning,
                      timestamp: new Date().toISOString(),
                    }
                  );
                },
              ],
            },
            "Cleaning Requested": {
              on: {
                approveCleaning: {
                  target: "Cleaning Approved",
                  actions: "approveCleaningService",
                },
                declineCleaning: {
                  target: "Cleaning Declined",
                  actions: "declineCleaningService",
                },
              },
              entry: [
                ({ context }) => {
                  console.log(
                    `⏳ XSTATE SUBSTATE: Cleaning Request Pending Approval [MEDIA COMMONS]`,
                    {
                      tenant: context.tenant,
                      timestamp: new Date().toISOString(),
                    }
                  );
                },
              ],
            },
            "Cleaning Approved": {
              type: "final",
              entry: [
                ({ context }) => {
                  console.log(
                    `✅ XSTATE SUBSTATE: Cleaning Request APPROVED [MEDIA COMMONS]`,
                    {
                      tenant: context.tenant,
                      timestamp: new Date().toISOString(),
                    }
                  );
                },
              ],
            },
            "Cleaning Declined": {
              type: "final",
              entry: [
                ({ context }) => {
                  console.log(
                    `❌ XSTATE SUBSTATE: Cleaning Request DECLINED [MEDIA COMMONS]`,
                    {
                      tenant: context.tenant,
                      timestamp: new Date().toISOString(),
                    }
                  );
                },
              ],
            },
          },
        },
        "Security Request": {
          initial: "Evaluate Security Request",
          states: {
            "Evaluate Security Request": {
              always: [
                {
                  target: "Security Requested",
                  guard: {
                    type: "securityRequested",
                  },
                },
                {
                  target: "Security Approved",
                },
              ],
              entry: [
                ({ context }) => {
                  console.log(
                    `🔍 XSTATE SUBSTATE: Evaluating Security Request [MEDIA COMMONS]`,
                    {
                      tenant: context.tenant,
                      securityRequested: context.servicesRequested?.security,
                      timestamp: new Date().toISOString(),
                    }
                  );
                },
              ],
            },
            "Security Requested": {
              on: {
                approveSecurity: {
                  target: "Security Approved",
                  actions: "approveSecurityService",
                },
                declineSecurity: {
                  target: "Security Declined",
                  actions: "declineSecurityService",
                },
              },
              entry: [
                ({ context }) => {
                  console.log(
                    `⏳ XSTATE SUBSTATE: Security Request Pending Approval [MEDIA COMMONS]`,
                    {
                      tenant: context.tenant,
                      timestamp: new Date().toISOString(),
                    }
                  );
                },
              ],
            },
            "Security Approved": {
              type: "final",
              entry: [
                ({ context }) => {
                  console.log(
                    `✅ XSTATE SUBSTATE: Security Request APPROVED [MEDIA COMMONS]`,
                    {
                      tenant: context.tenant,
                      timestamp: new Date().toISOString(),
                    }
                  );
                },
              ],
            },
            "Security Declined": {
              type: "final",
              entry: [
                ({ context }) => {
                  console.log(
                    `❌ XSTATE SUBSTATE: Security Request DECLINED [MEDIA COMMONS]`,
                    {
                      tenant: context.tenant,
                      timestamp: new Date().toISOString(),
                    }
                  );
                },
              ],
            },
          },
        },
        "Equipment Request": {
          initial: "Evaluate Equipment Request",
          states: {
            "Evaluate Equipment Request": {
              always: [
                {
                  target: "Equipment Requested",
                  guard: {
                    type: "equipRequested",
                  },
                },
                {
                  target: "Equipment Approved",
                },
              ],
              entry: [
                ({ context }) => {
                  console.log(
                    `🔍 XSTATE SUBSTATE: Evaluating Equipment Request [MEDIA COMMONS]`,
                    {
                      tenant: context.tenant,
                      equipmentRequested: context.servicesRequested?.equipment,
                      timestamp: new Date().toISOString(),
                    }
                  );
                },
              ],
            },
            "Equipment Requested": {
              on: {
                approveEquipment: {
                  target: "Equipment Approved",
                  actions: "approveEquipmentService",
                },
                declineEquipment: {
                  target: "Equipment Declined",
                  actions: "declineEquipmentService",
                },
              },
              entry: [
                ({ context }) => {
                  console.log(
                    `⏳ XSTATE SUBSTATE: Equipment Request Pending Approval [MEDIA COMMONS]`,
                    {
                      tenant: context.tenant,
                      timestamp: new Date().toISOString(),
                    }
                  );
                },
              ],
            },
            "Equipment Approved": {
              type: "final",
              entry: [
                ({ context }) => {
                  console.log(
                    `✅ XSTATE SUBSTATE: Equipment Request APPROVED [MEDIA COMMONS]`,
                    {
                      tenant: context.tenant,
                      timestamp: new Date().toISOString(),
                    }
                  );
                },
              ],
            },
            "Equipment Declined": {
              type: "final",
              entry: [
                ({ context }) => {
                  console.log(
                    `❌ XSTATE SUBSTATE: Equipment Request DECLINED [MEDIA COMMONS]`,
                    {
                      tenant: context.tenant,
                      timestamp: new Date().toISOString(),
                    }
                  );
                },
              ],
            },
          },
        },
      },
    },
    "Pre-approved": {
      on: {
        approve: [
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
          console.log(`🏁 XSTATE STATE: Entered 'Pre-approved' state`, {
            tenant: context.tenant,
            timestamp: new Date().toISOString(),
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
            `🏁 XSTATE STATE: Entered 'Service Closeout' parallel state [MEDIA COMMONS]`,
            {
              tenant: context.tenant,
              timestamp: new Date().toISOString(),
              servicesApproved: context.servicesApproved,
            }
          );
        },
      ],
      states: {
        "Equipment Closeout": {
          initial: "Evaluate Equipment",
          states: {
            "Evaluate Equipment": {
              always: [
                {
                  target: "Equipment Closeout Pending",
                  guard: {
                    type: "equipApproved",
                  },
                },
                {
                  target: "Equipment Closedout",
                },
              ],
              entry: [
                ({ context }) => {
                  console.log(
                    `🔍 XSTATE CLOSEOUT: Evaluating Equipment Closeout [MEDIA COMMONS]`,
                    {
                      tenant: context.tenant,
                      equipmentApproved: context.servicesApproved?.equipment,
                      timestamp: new Date().toISOString(),
                    }
                  );
                },
              ],
            },
            "Equipment Closeout Pending": {
              on: {
                closeoutEquipment: {
                  target: "Equipment Closedout",
                },
              },
              entry: [
                ({ context }) => {
                  console.log(
                    `⏳ XSTATE CLOSEOUT: Equipment Closeout Pending [MEDIA COMMONS]`,
                    {
                      tenant: context.tenant,
                      timestamp: new Date().toISOString(),
                    }
                  );
                },
              ],
            },
            "Equipment Closedout": {
              type: "final",
              entry: [
                ({ context }) => {
                  console.log(
                    `✅ XSTATE CLOSEOUT: Equipment CLOSED OUT [MEDIA COMMONS]`,
                    {
                      tenant: context.tenant,
                      timestamp: new Date().toISOString(),
                    }
                  );
                },
              ],
            },
          },
        },
        "Staff Closeout": {
          initial: "Evaluate Staff",
          states: {
            "Evaluate Staff": {
              always: [
                {
                  target: "Staff Closeout Pending",
                  guard: {
                    type: "staffApproved",
                  },
                },
                {
                  target: "Staff Closedout",
                },
              ],
              entry: [
                ({ context }) => {
                  console.log(
                    `🔍 XSTATE CLOSEOUT: Evaluating Staff Closeout [MEDIA COMMONS]`,
                    {
                      tenant: context.tenant,
                      staffApproved: context.servicesApproved?.staff,
                      timestamp: new Date().toISOString(),
                    }
                  );
                },
              ],
            },
            "Staff Closeout Pending": {
              on: {
                closeoutStaff: {
                  target: "Staff Closedout",
                },
              },
              entry: [
                ({ context }) => {
                  console.log(
                    `⏳ XSTATE CLOSEOUT: Staff Closeout Pending [MEDIA COMMONS]`,
                    {
                      tenant: context.tenant,
                      timestamp: new Date().toISOString(),
                    }
                  );
                },
              ],
            },
            "Staff Closedout": {
              type: "final",
              entry: [
                ({ context }) => {
                  console.log(
                    `✅ XSTATE CLOSEOUT: Staff CLOSED OUT [MEDIA COMMONS]`,
                    {
                      tenant: context.tenant,
                      timestamp: new Date().toISOString(),
                    }
                  );
                },
              ],
            },
          },
        },
        "Setup Closeout": {
          initial: "Evaluate Setup",
          states: {
            "Evaluate Setup": {
              always: [
                {
                  target: "Setup Closeout Pending",
                  guard: {
                    type: "setupApproved",
                  },
                },
                {
                  target: "Setup Closedout",
                },
              ],
              entry: [
                ({ context }) => {
                  console.log(
                    `🔍 XSTATE CLOSEOUT: Evaluating Setup Closeout [MEDIA COMMONS]`,
                    {
                      tenant: context.tenant,
                      setupApproved: context.servicesApproved?.setup,
                      timestamp: new Date().toISOString(),
                    }
                  );
                },
              ],
            },
            "Setup Closeout Pending": {
              on: {
                closeoutSetup: {
                  target: "Setup Closedout",
                },
              },
              entry: [
                ({ context }) => {
                  console.log(
                    `⏳ XSTATE CLOSEOUT: Setup Closeout Pending [MEDIA COMMONS]`,
                    {
                      tenant: context.tenant,
                      timestamp: new Date().toISOString(),
                    }
                  );
                },
              ],
            },
            "Setup Closedout": {
              type: "final",
              entry: [
                ({ context }) => {
                  console.log(
                    `✅ XSTATE CLOSEOUT: Setup CLOSED OUT [MEDIA COMMONS]`,
                    {
                      tenant: context.tenant,
                      timestamp: new Date().toISOString(),
                    }
                  );
                },
              ],
            },
          },
        },
        "Catering Closeout": {
          initial: "Evaluate Catering",
          states: {
            "Evaluate Catering": {
              always: [
                {
                  target: "Catering Closeout Pending",
                  guard: {
                    type: "cateringApproved",
                  },
                },
                {
                  target: "Catering Closedout",
                },
              ],
              entry: [
                ({ context }) => {
                  console.log(
                    `🔍 XSTATE CLOSEOUT: Evaluating Catering Closeout [MEDIA COMMONS]`,
                    {
                      tenant: context.tenant,
                      cateringApproved: context.servicesApproved?.catering,
                      timestamp: new Date().toISOString(),
                    }
                  );
                },
              ],
            },
            "Catering Closeout Pending": {
              on: {
                closeoutCatering: {
                  target: "Catering Closedout",
                },
              },
              entry: [
                ({ context }) => {
                  console.log(
                    `⏳ XSTATE CLOSEOUT: Catering Closeout Pending [MEDIA COMMONS]`,
                    {
                      tenant: context.tenant,
                      timestamp: new Date().toISOString(),
                    }
                  );
                },
              ],
            },
            "Catering Closedout": {
              type: "final",
              entry: [
                ({ context }) => {
                  console.log(
                    `✅ XSTATE CLOSEOUT: Catering CLOSED OUT [MEDIA COMMONS]`,
                    {
                      tenant: context.tenant,
                      timestamp: new Date().toISOString(),
                    }
                  );
                },
              ],
            },
          },
        },
        "Security Closeout": {
          initial: "Evaluate Security",
          states: {
            "Evaluate Security": {
              always: [
                {
                  target: "Security Closeout Pending",
                  guard: {
                    type: "securityApproved",
                  },
                },
                {
                  target: "Security Closedout",
                },
              ],
              entry: [
                ({ context }) => {
                  console.log(
                    `🔍 XSTATE CLOSEOUT: Evaluating Security Closeout [MEDIA COMMONS]`,
                    {
                      tenant: context.tenant,
                      securityApproved: context.servicesApproved?.security,
                      timestamp: new Date().toISOString(),
                    }
                  );
                },
              ],
            },
            "Security Closeout Pending": {
              on: {
                closeoutSecurity: {
                  target: "Security Closedout",
                },
              },
              entry: [
                ({ context }) => {
                  console.log(
                    `⏳ XSTATE CLOSEOUT: Security Closeout Pending [MEDIA COMMONS]`,
                    {
                      tenant: context.tenant,
                      timestamp: new Date().toISOString(),
                    }
                  );
                },
              ],
            },
            "Security Closedout": {
              type: "final",
              entry: [
                ({ context }) => {
                  console.log(
                    `✅ XSTATE CLOSEOUT: Security CLOSED OUT [MEDIA COMMONS]`,
                    {
                      tenant: context.tenant,
                      timestamp: new Date().toISOString(),
                    }
                  );
                },
              ],
            },
          },
        },
        "Cleaning Closeout": {
          initial: "Evaluate Cleaning",
          states: {
            "Evaluate Cleaning": {
              always: [
                {
                  target: "Cleaning Closeout Pending",
                  guard: {
                    type: "cleanApproved",
                  },
                },
                {
                  target: "Cleaning Closedout",
                },
              ],
              entry: [
                ({ context }) => {
                  console.log(
                    `🔍 XSTATE CLOSEOUT: Evaluating Cleaning Closeout [MEDIA COMMONS]`,
                    {
                      tenant: context.tenant,
                      cleaningApproved: context.servicesApproved?.cleaning,
                      timestamp: new Date().toISOString(),
                    }
                  );
                },
              ],
            },
            "Cleaning Closeout Pending": {
              on: {
                closeoutCleaning: {
                  target: "Cleaning Closedout",
                },
              },
              entry: [
                ({ context }) => {
                  console.log(
                    `⏳ XSTATE CLOSEOUT: Cleaning Closeout Pending [MEDIA COMMONS]`,
                    {
                      tenant: context.tenant,
                      timestamp: new Date().toISOString(),
                    }
                  );
                },
              ],
            },
            "Cleaning Closedout": {
              type: "final",
              entry: [
                ({ context }) => {
                  console.log(
                    `✅ XSTATE CLOSEOUT: Cleaning CLOSED OUT [MEDIA COMMONS]`,
                    {
                      tenant: context.tenant,
                      timestamp: new Date().toISOString(),
                    }
                  );
                },
              ],
            },
          },
        },
      },
    },
    Closed: {
      type: "final",
      entry: [
        ({ context }) => {
          console.log(`🏁 XSTATE STATE: Entered 'Closed' state (final)`, {
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
          console.log(`🏁 XSTATE STATE: Entered 'Checked In' state`, {
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
      },
      entry: [
        ({ context }) => {
          console.log(`🏁 XSTATE STATE: Entered 'No Show' state`, {
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
            `🔍 XSTATE STATE: Evaluating Services Request Results [MEDIA COMMONS]`,
            {
              tenant: context.tenant,
              timestamp: new Date().toISOString(),
              servicesRequested: context.servicesRequested,
              servicesApproved: context.servicesApproved,
            }
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
          console.log(`🏁 XSTATE STATE: Entered 'Checked Out' state`, {
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
