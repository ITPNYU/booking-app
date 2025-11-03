import { setup } from "xstate";
import { getBookingHourLimits } from "@/components/src/client/routes/booking/utils/bookingHourLimits";
import { Role } from "@/components/src/types";

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
          context.isVip || false
        );
        
        if (durationHours > maxHours) {
          console.log(
            `🚫 XSTATE GUARD: Event duration exceeds maximum (${durationHours.toFixed(1)} hours > ${maxHours} hours max for ${context.role || "student"} ${context.isVip ? "VIP" : context.isWalkIn ? "walk-in" : "booking"})`
          );
          console.log(
            `🎯 XSTATE AUTO-APPROVAL GUARD RESULT: REJECTED (Duration exceeds max limit)`
          );
          return false;
        }
        
        if (durationHours < minHours) {
          console.log(
            `🚫 XSTATE GUARD: Event duration below minimum (${durationHours.toFixed(1)} hours < ${minHours} hours min for ${context.role || "student"} ${context.isVip ? "VIP" : context.isWalkIn ? "walk-in" : "booking"})`
          );
          console.log(
            `🎯 XSTATE AUTO-APPROVAL GUARD RESULT: REJECTED (Duration below min limit)`
          );
          return false;
        }
      }

      // Check rooms require approval
      if (context.selectedRooms && !context.isWalkIn) {
        const allRoomsAutoApprove = context.selectedRooms.every(
          (room) => room.shouldAutoApprove || false
        );
        if (!allRoomsAutoApprove) {
          console.log(
            `🚫 XSTATE GUARD: At least one room is not eligible for auto approval`,
            {
              roomsAutoApprove: context.selectedRooms.map((r) => ({
                roomId: r.roomId,
                shouldAutoApprove: r.shouldAutoApprove,
              })),
            }
          );
          console.log(
            `🎯 XSTATE AUTO-APPROVAL GUARD RESULT: REJECTED (Room not auto-approvable)`
          );
          return false;
        }
      }

      // Check form data conditions
      if (context.formData) {
        if (context.formData.roomSetup === "yes") {
          console.log(`🚫 XSTATE GUARD: Room setup requires approval`);
          console.log(
            `🎯 XSTATE AUTO-APPROVAL GUARD RESULT: REJECTED (Room setup required)`
          );
          return false;
        }

        if (!context.isWalkIn && context.formData.mediaServices?.length > 0) {
          console.log(`🚫 XSTATE GUARD: Media services require approval`, {
            mediaServices: context.formData.mediaServices,
          });
          console.log(
            `🎯 XSTATE AUTO-APPROVAL GUARD RESULT: REJECTED (Media services required)`
          );
          return false;
        }

        if (context.formData.catering === "yes") {
          console.log(`🚫 XSTATE GUARD: Catering requires approval`);
          console.log(
            `🎯 XSTATE AUTO-APPROVAL GUARD RESULT: REJECTED (Catering required)`
          );
          return false;
        }

        if (context.formData.hireSecurity === "yes") {
          console.log(`🚫 XSTATE GUARD: Security requires approval`);
          console.log(
            `🎯 XSTATE AUTO-APPROVAL GUARD RESULT: REJECTED (Security required)`
          );
          return false;
        }
      }

      console.log(`✅ XSTATE GUARD: All conditions met for auto-approval`);
      console.log(`🎯 XSTATE AUTO-APPROVAL GUARD RESULT: APPROVED`);
      return true;
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
