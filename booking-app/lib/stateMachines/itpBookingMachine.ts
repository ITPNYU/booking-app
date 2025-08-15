import { createMachine } from "xstate";

export const itpBookingMachine = createMachine(
  {
    context: {},
    id: "ITP Booking Request",
    initial: "Requested",
    states: {
      Requested: {
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
            guard: "shouldAutoApprove",
          },
          {
            target: "Requested",
          },
        ],
        entry: [
          {
            type: "createCalendarEvent",
          },
          {
            type: "sendHTMLEmail",
          },
        ],
      },
      Canceled: {
        always: {
          target: "Closed",
        },
        entry: {
          type: "sendHTMLEmail",
        },
      },
      Declined: {
        on: {
          edit: {
            target: "Requested",
          },
        },
        after: {
          "86400000": {
            target: "Closed",
          },
        },
        entry: {
          type: "sendHTMLEmail",
        },
      },
      Approved: {
        on: {
          close: {
            target: "Closed",
          },
          cancel: {
            target: "Canceled",
          },
        },
        entry: {
          type: "sendHTMLEmail",
        },
      },
      Closed: {
        type: "final",
        entry: {
          type: "sendHTMLEmail",
        },
      },
    },
  },
  {
    actions: {
      createCalendarEvent: function (context, event) {
        // Add your action code here
        // ...
      },
      sendHTMLEmail: function (context, event) {
        // Add your action code here
        // ...
      },
    },
    guards: {
      shouldAutoApprove: function (context, event) {
        // Always return true for ITP tenant auto-approval
        console.log("Xstate shouldAutoApprove", context, event);
        return true;
      },
    },
  }
);
