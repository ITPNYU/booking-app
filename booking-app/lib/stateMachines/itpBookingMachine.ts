import { setup } from "xstate";
import { Role } from "@/components/src/types";
import { checkAutoApprovalEligibility } from "@/lib/utils/autoApprovalUtils";

// Time constants for clarity
const ONE_HOUR_IN_MS = 60 * 60 * 1000;

// Define context type for type safety
interface BookingContext {
  tenant?: string;
  selectedRooms?: any[];
  formData?: any;
  bookingCalendarInfo?: any;
  isWalkIn?: boolean;
  isVip?: boolean;
  role?: Role;
  calendarEventId?: string | null;
  email?: string;
}

export const itpBookingMachine = setup({
  types: {
    context: {} as BookingContext,
    events: {} as
      | { type: "edit" }
      | { type: "close" }
      | { type: "cancel" }
      | { type: "noShow" }
      | { type: "approve" }
      | { type: "checkIn" }
      | { type: "decline" }
      | { type: "checkOut" }
      | { type: "autoCloseScript" },
  },
  guards: {
    shouldAutoApprove: ({ context }) => {
      console.log(
        `🎯 XSTATE AUTO-APPROVAL GUARD STARTED [${context.tenant?.toUpperCase() || "UNKNOWN"}]:`,
        {
          context,
          tenant: context.tenant,
          selectedRooms: context.selectedRooms?.length,
          formData: context.formData,
          bookingDuration: context.bookingCalendarInfo
            ? `${((new Date(context.bookingCalendarInfo.endStr).getTime() - new Date(context.bookingCalendarInfo.startStr).getTime()) / (1000 * 60 * 60)).toFixed(1)} hours`
            : "Not set",
          isWalkIn: context.isWalkIn,
        },
      );

      // Implement actual auto-approval logic for ITP
      if (context.tenant !== "itp") {
        console.log(
          `🚫 XSTATE GUARD: Not ITP tenant (${context.tenant}), rejecting auto-approval`,
        );
        console.log(
          "🎯 XSTATE AUTO-APPROVAL GUARD RESULT: REJECTED (Wrong tenant)",
        );
        return false;
      }

      // Calculate duration if calendar info is available
      let durationHours: number | undefined;
      if (context.bookingCalendarInfo) {
        const startDate = new Date(context.bookingCalendarInfo.startStr);
        const endDate = new Date(context.bookingCalendarInfo.endStr);
        const duration = endDate.getTime() - startDate.getTime();
        durationHours = duration / ONE_HOUR_IN_MS;
      }

      // Map formData to servicesRequested format
      const servicesRequested = context.formData
        ? {
            setup: context.formData.roomSetup === "yes",
            equipment: context.formData.mediaServices?.length > 0 || false,
            staffing: false, // ITP doesn't have separate staffing field in formData
            catering: context.formData.catering === "yes",
            cleaning: false, // ITP doesn't have separate cleaning field in formData
            security: context.formData.hireSecurity === "yes",
          }
        : undefined;

      // Use the new auto-approval utility
      const result = checkAutoApprovalEligibility({
        selectedRooms: context.selectedRooms || [],
        role: context.role,
        isWalkIn: context.isWalkIn,
        isVip: false, // ITP doesn't support VIP
        durationHours,
        servicesRequested,
      });

      if (result.canAutoApprove) {
        console.log("✅ XSTATE GUARD: All conditions met for auto-approval");
        console.log("🎯 XSTATE AUTO-APPROVAL GUARD RESULT: APPROVED", {
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
  },
  actions: {
    handleDeclineProcessing: async ({ context, event }) => {
      try {
        const { calendarEventId, tenant, email } = context;

        if (calendarEventId) {
          const response = await fetch(
            `${process.env.NEXT_PUBLIC_BASE_URL}/api/decline-processing`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "x-tenant": tenant || "itp",
              },
              body: JSON.stringify({
                calendarEventId,
                email,
                tenant,
              }),
            },
          );

          if (!response.ok) {
            const errorText = await response.text();
            console.error(
              `[XState] decline processing failed [${tenant?.toUpperCase() || "UNKNOWN"}]`,
              { calendarEventId, status: response.status, error: errorText },
            );
          }
        }
      } catch (error: any) {
        console.error(
          `[XState] decline processing error [${context.tenant?.toUpperCase() || "UNKNOWN"}]`,
          { calendarEventId: context.calendarEventId, error: error.message },
        );
      }
    },
    handleCheckinProcessing: async ({ context, event }) => {
      try {
        const { calendarEventId, tenant, email } = context;

        if (calendarEventId) {
          const response = await fetch(
            `${process.env.NEXT_PUBLIC_BASE_URL}/api/checkin-processing`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "x-tenant": tenant || "itp",
              },
              body: JSON.stringify({
                calendarEventId,
                email,
                tenant,
              }),
            },
          );

          if (!response.ok) {
            const errorText = await response.text();
            console.error(
              `[XState] checkin processing failed [${tenant?.toUpperCase() || "UNKNOWN"}]`,
              { calendarEventId, status: response.status, error: errorText },
            );
          }
        }
      } catch (error: any) {
        console.error(
          `[XState] checkin processing error [${context.tenant?.toUpperCase() || "UNKNOWN"}]`,
          { calendarEventId: context.calendarEventId, error: error.message },
        );
      }
    },
    handleCancelProcessing: async ({ context, event }) => {
      try {
        const { calendarEventId, tenant, email } = context;

        if (calendarEventId) {
          const response = await fetch(
            `${process.env.NEXT_PUBLIC_BASE_URL}/api/cancel-processing`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "x-tenant": tenant || "itp",
              },
              body: JSON.stringify({
                calendarEventId,
                email: email || "system",
                netId: email?.split("@")[0] || "system",
                tenant,
              }),
            },
          );

          if (!response.ok) {
            const errorText = await response.text();
            console.error(
              `[XState] cancel processing failed [${tenant?.toUpperCase() || "UNKNOWN"}]`,
              { calendarEventId, status: response.status, error: errorText },
            );
          }
        }
      } catch (error: any) {
        console.error(
          `[XState] cancel processing error [${context.tenant?.toUpperCase() || "UNKNOWN"}]`,
          { calendarEventId: context.calendarEventId, error: error.message },
        );
      }
    },
    handleCloseProcessing: async ({ context, event }) => {
      try {
        const { calendarEventId, tenant, email } = context;

        if (calendarEventId) {
          const response = await fetch(
            `${process.env.NEXT_PUBLIC_BASE_URL}/api/close-processing`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "x-tenant": tenant || "itp",
              },
              body: JSON.stringify({
                calendarEventId,
                email: email || "system",
                tenant,
              }),
            },
          );

          if (!response.ok) {
            const errorText = await response.text();
            console.error(
              `[XState] close processing failed [${tenant?.toUpperCase() || "UNKNOWN"}]`,
              { calendarEventId, status: response.status, error: errorText },
            );
          }
        }
      } catch (error: any) {
        console.error(
          `[XState] close processing error [${context.tenant?.toUpperCase() || "UNKNOWN"}]`,
          { calendarEventId: context.calendarEventId, error: error.message },
        );
      }
    },
    createCalendarEvent: ({ context, event }) => {
      // Placeholder — actual calendar creation handled outside XState
    },
    sendHTMLEmail: ({ context, event }) => {
      // Placeholder — actual email sending handled by processing routes
    },
    updateCalendarEvent: ({ context, event }) => {
      // Placeholder — actual calendar update handled by processing routes
    },
    deleteCalendarEvent: ({ context, event }) => {
      // Placeholder — actual calendar deletion handled by processing routes
    },
  },
}).createMachine({
  context: ({ input }: { input?: BookingContext }) => ({
    tenant: input?.tenant,
    selectedRooms: input?.selectedRooms,
    formData: input?.formData,
    bookingCalendarInfo: input?.bookingCalendarInfo,
    isWalkIn: input?.isWalkIn || false,
    calendarEventId: input?.calendarEventId,
    email: input?.email,
  }),
  id: "ITP Booking Request",
  initial: "Requested",
  states: {
    Requested: {
      entry: [
        ({ context }) => {
          console.log("🏁 XSTATE STATE: Entered 'Requested' state", {
            tenant: context.tenant,
            timestamp: new Date().toISOString(),
          });
        },
        {
          type: "createCalendarEvent",
        },
        {
          type: "sendHTMLEmail",
        },
      ],
      on: {
        edit: {
          target: "Requested",
        },
        cancel: {
          target: "Canceled",
        },
        decline: {
          target: "Declined",
        },
        approve: {
          target: "Approved",
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
          target: "Requested",
        },
      ],
    },
    Canceled: {
      entry: [
        {
          type: "handleCancelProcessing",
        },
      ],
      always: {
        target: "Closed",
      },
    },
    Declined: {
      entry: [
        {
          type: "handleDeclineProcessing",
        },
      ],
      on: {
        edit: {
          target: "Requested",
        },
      },
      after: {
        "86400000": {
          target: "Canceled",
        },
      },
    },
    Approved: {
      entry: [
        ({ context }) => {
          console.log("🏁 XSTATE STATE: Entered 'Approved' state", {
            tenant: context.tenant,
            timestamp: new Date().toISOString(),
          });
          console.log("🎉 XSTATE: AUTO-APPROVAL SUCCESSFUL!");
        },
        {
          type: "sendHTMLEmail",
        },
        {
          type: "updateCalendarEvent",
        },
      ],
      on: {
        cancel: {
          target: "Canceled",
        },
        checkIn: {
          target: "Checked In",
        },
        noShow: {
          target: "No Show",
        },
        autoCloseScript: {
          target: "Closed",
        },
      },
    },
    Closed: {
      type: "final",
      entry: [
        {
          type: "handleCloseProcessing",
        },
      ],
    },
    "Checked In": {
      entry: [
        {
          type: "handleCheckinProcessing",
        },
      ],
      on: {
        checkOut: {
          target: "Checked Out",
        },
      },
    },
    "No Show": {
      always: {
        target: "Canceled",
      },
    },
    "Checked Out": {
      on: {
        close: {
          target: "Closed",
        },
      },
    },
  },
});
