import "server-only";

import { setup, assign } from "xstate";
import { Role } from "@/components/src/types";
import { evaluateItpShouldAutoApprove } from "@/lib/stateMachines/autoApprovalGuards";
import { logAutomaticCancellationTransition, type AutomaticCancellationReason } from "@/lib/stateMachines/logAutomaticCancellationTransition";

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
  automationReason?: AutomaticCancellationReason; // Tracks automatic transitions
  // Queue of side effects declared by state entry actions. Machine stays pure
  // (assign only); xstate-transition route drains and executes the list after
  // the transition, then clears it before persisting the snapshot.
  pendingSideEffects?: string[];
}

export const itpBookingMachine = setup({
  types: {
    context: {} as BookingContext,
    events: {} as
      | { type: "edit" }
      | { type: "cancel" }
      | { type: "noShow" }
      | { type: "approve" }
      | { type: "checkIn" }
      | { type: "decline" }
      | { type: "checkOut" }
      | { type: "autoCloseScript" },
  },
  guards: {
    shouldAutoApprove: ({ context }) =>
      evaluateItpShouldAutoApprove(context),
  },
  actions: {
    createCalendarEvent: ({ context, event }) => {
      console.log("📅 XSTATE ACTION: createCalendarEvent executed", {
        tenant: context.tenant,
        selectedRoomsCount: context.selectedRooms?.length,
        calendarEventId: context.calendarEventId,
      });
    },
    sendHTMLEmail: ({ context, event }) => {
      console.log("📧 XSTATE ACTION: sendHTMLEmail executed", {
        tenant: context.tenant,
        hasFormData: !!context.formData,
        email: context.email,
      });
    },
    updateCalendarEvent: ({ context, event }) => {
      console.log("📅 XSTATE ACTION: updateCalendarEvent executed", {
        tenant: context.tenant,
        calendarEventId: context.calendarEventId,
      });
    },
    deleteCalendarEvent: ({ context, event }) => {
      console.log("🗑️ XSTATE ACTION: deleteCalendarEvent executed", {
        tenant: context.tenant,
        calendarEventId: context.calendarEventId,
      });
    },
    // Queue a side effect for the xstate-transition route to execute after
    // the machine finishes transitioning. Pure assign — safe on both server
    // and client.
    queueCancelProcessing: assign({
      pendingSideEffects: ({ context }) => [
        ...(context.pendingSideEffects ?? []),
        "cancelProcessing",
      ],
    }),
    logCanceledAfterAutomaticTransition: async (
      { context },
    ): Promise<void> => {
      await logAutomaticCancellationTransition(context);
    },
  },
}).createMachine({
  context: ({ input }: { input?: BookingContext }) => ({
    tenant: input?.tenant,
    selectedRooms: input?.selectedRooms,
    formData: input?.formData,
    bookingCalendarInfo: input?.bookingCalendarInfo,
    isWalkIn: input?.isWalkIn || false,
    isVip: input?.isVip || false,
    role: input?.role,
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
        ({ context }) => {
          console.log("🏁 XSTATE STATE: Entered 'Canceled' state", {
            tenant: context.tenant,
            timestamp: new Date().toISOString(),
          });
        },
        {
          type: "queueCancelProcessing",
        },
        {
          type: "logCanceledAfterAutomaticTransition",
        },
      ],
      always: {
        target: "Closed",
      },
    },
    Declined: {
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
      on: {
        edit: {
          target: "Requested",
        },
      },
      after: {
        "86400000": {
          target: "Canceled",
          actions: [assign({ automationReason: "decline" })],
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
        ({ context }) => {
          console.log("🏁 XSTATE STATE: Entered 'Closed' state (final)", {
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
      on: {
        checkOut: {
          target: "Checked Out",
        },
      },
    },
    "No Show": {
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
      ],
      always: {
        target: "Canceled",
        actions: [assign({ automationReason: "no-show" })],
      },
    },
    "Checked Out": {
      entry: [
        ({ context }) => {
          console.log("🏁 XSTATE STATE: Entered 'Checked Out' state", {
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
      // ITP has no service closeout, so auto-close immediately
      always: {
        target: "Closed",
      },
    },
  },
});
