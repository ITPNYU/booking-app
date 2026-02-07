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
        }
      );

      // Implement actual auto-approval logic for ITP
      if (context.tenant !== "itp") {
        console.log(
          `🚫 XSTATE GUARD: Not ITP tenant (${context.tenant}), rejecting auto-approval`
        );
        console.log(
          `🎯 XSTATE AUTO-APPROVAL GUARD RESULT: REJECTED (Wrong tenant)`
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
        console.log(`✅ XSTATE GUARD: All conditions met for auto-approval`);
        console.log(`🎯 XSTATE AUTO-APPROVAL GUARD RESULT: APPROVED`, {
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
  },
  actions: {
    createCalendarEvent: ({ context, event }) => {
      console.log(`📅 XSTATE ACTION: createCalendarEvent executed`, {
        tenant: context.tenant,
        selectedRoomsCount: context.selectedRooms?.length,
        calendarEventId: context.calendarEventId,
      });
    },
    sendHTMLEmail: ({ context, event }) => {
      console.log(`📧 XSTATE ACTION: sendHTMLEmail executed`, {
        tenant: context.tenant,
        hasFormData: !!context.formData,
        email: context.email,
      });
    },
    updateCalendarEvent: ({ context, event }) => {
      console.log(`📅 XSTATE ACTION: updateCalendarEvent executed`, {
        tenant: context.tenant,
        calendarEventId: context.calendarEventId,
      });
    },
    deleteCalendarEvent: ({ context, event }) => {
      console.log(`🗑️ XSTATE ACTION: deleteCalendarEvent executed`, {
        tenant: context.tenant,
        calendarEventId: context.calendarEventId,
      });
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
          console.log(`🏁 XSTATE STATE: Entered 'Requested' state`, {
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
        ({ context }) => {
          console.log(`🏁 XSTATE STATE: Entered 'Canceled' state`, {
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
        {
          type: "deleteCalendarEvent",
        },
      ],
      always: {
        target: "Closed",
      },
    },
    Declined: {
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
          console.log(`🏁 XSTATE STATE: Entered 'Approved' state`, {
            tenant: context.tenant,
            timestamp: new Date().toISOString(),
          });
          console.log(`🎉 XSTATE: AUTO-APPROVAL SUCCESSFUL!`);
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
        ({ context }) => {
          console.log(`🏁 XSTATE STATE: Entered 'Closed' state (final)`, {
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
    "Checked In": {
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
      on: {
        checkOut: {
          target: "Checked Out",
        },
      },
    },
    "No Show": {
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
      ],
      always: {
        target: "Canceled",
      },
    },
    "Checked Out": {
      entry: [
        ({ context }) => {
          console.log(`🏁 XSTATE STATE: Entered 'Checked Out' state`, {
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
      on: {
        close: {
          target: "Closed",
        },
      },
    },
  },
});
