import { approvalFlowSchema } from "@/components/src/client/routes/components/schemaTypes";

const DAY_MS = 86_400_000;

/** ITP booking graph. Console-only entry logs from the TypeScript machine are omitted. */
export const itpApprovalFlow = approvalFlowSchema.parse({
  version: 1,
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
        { target: "Approved", guard: "shouldAutoApprove" },
        { target: "Requested" },
      ],
      entry: [{ type: "createCalendarEvent" }, { type: "sendHTMLEmail" }],
    },
    Canceled: {
      always: [{ target: "Closed" }],
      entry: [
        { type: "queueCancelProcessing" },
        { type: "logCanceledAfterAutomaticTransition" },
      ],
    },
    Declined: {
      on: { edit: { target: "Requested" } },
      after: [
        {
          delayMs: DAY_MS,
          target: "Canceled",
          actions: [{ type: "setAutomationReason", params: { reason: "decline" } }],
        },
      ],
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
      always: [
        {
          target: "Canceled",
          actions: [
            { type: "setAutomationReason", params: { reason: "no-show" } },
          ],
        },
      ],
      entry: [{ type: "updateCalendarEvent" }],
    },
    "Checked Out": {
      always: [{ target: "Closed" }],
      entry: [{ type: "sendHTMLEmail" }, { type: "updateCalendarEvent" }],
    },
  },
});
