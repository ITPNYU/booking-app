import { approvalFlowSchema } from "@/components/src/client/routes/components/schemaTypes";

/** ITP booking graph, copied from the createMachine argument. */
export const itpApprovalFlow = approvalFlowSchema.parse({
  id: "ITP Booking Request",
  initial: "Requested",
  states: {
    Requested: {
      on: {
        edit: { target: "Requested" },
        cancel: { target: "Canceled" },
        decline: { target: "Declined" },
        approve: { target: "Approved" },
      },
      always: [
        { target: "Approved", guard: { type: "shouldAutoApprove" } },
        { target: "Requested" },
      ],
      entry: [{ type: "createCalendarEvent" }, { type: "sendHTMLEmail" }],
    },
    Canceled: {
      always: { target: "Closed" },
      entry: [
        { type: "queueCancelProcessing" },
        { type: "logCanceledAfterAutomaticTransition" },
      ],
    },
    Declined: {
      on: { edit: { target: "Requested" } },
      after: {
        "86400000": {
          target: "Canceled",
          actions: [
            { type: "setAutomationReason", params: { reason: "decline" } },
          ],
        },
      },
      entry: [{ type: "sendHTMLEmail" }, { type: "updateCalendarEvent" }],
    },
    Approved: {
      on: {
        cancel: { target: "Canceled" },
        checkIn: { target: "Checked In" },
        noShow: { target: "No Show" },
        autoCloseScript: { target: "Closed" },
      },
      entry: [{ type: "sendHTMLEmail" }, { type: "updateCalendarEvent" }],
    },
    Closed: {
      type: "final",
      entry: [{ type: "sendHTMLEmail" }, { type: "updateCalendarEvent" }],
    },
    "Checked In": {
      on: { checkOut: { target: "Checked Out" } },
      entry: [{ type: "sendHTMLEmail" }, { type: "updateCalendarEvent" }],
    },
    "No Show": {
      always: {
        target: "Canceled",
        actions: [
          { type: "setAutomationReason", params: { reason: "no-show" } },
        ],
      },
      entry: [{ type: "updateCalendarEvent" }],
    },
    "Checked Out": {
      always: { target: "Closed" },
      entry: [{ type: "sendHTMLEmail" }, { type: "updateCalendarEvent" }],
    },
  },
});
