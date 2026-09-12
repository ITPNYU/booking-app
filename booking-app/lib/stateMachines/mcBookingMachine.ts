import "server-only";

import { setup } from "xstate";
import {
  buildMcInitialContext,
  mcBookingActions,
  mcBookingGuards,
} from "./mcBookingMachineImpl";
import type {
  MediaCommonsBookingContext,
  MediaCommonsBookingEvent,
} from "./mcBookingMachineTypes";

/**
 * Media Commons booking machine.
 *
 * ── Stately Studio round-trip ──────────────────────────────────────────────
 * The `createMachine({ ... })` block below is a plain object literal so the
 * file can be imported into Stately Studio, edited visually, and exported
 * back. Keep it that way:
 *   - no inline functions, spreads, template strings, or computed keys
 *   - guards and actions are referenced by name; implementations live in
 *     mcBookingMachineImpl.ts (an unknown name fails `tsc`)
 *   - state names and event names are persisted in Firestore
 *     (`xstateData.snapshot.value`) and compared as strings elsewhere —
 *     renaming one is a data migration, not an edit
 * When merging a Stately export, replace only the `createMachine(...)`
 * argument. tests/unit/mc-booking-machine-stately-literal.unit.test.ts and
 * mc-booking-machine-service-parity.unit.test.ts enforce the rules above.
 *
 * ⚠️ XSTATE PURITY CONSTRAINT:
 * The machine only transitions state and logs. No database writes, emails,
 * external API calls, or file operations here or in the impl file — those run
 * in the orchestration layer after the transition.
 */
export const mcBookingMachine = setup({
  types: {
    context: {} as MediaCommonsBookingContext,
    events: {} as MediaCommonsBookingEvent,
  },
  actors: {},
  actions: mcBookingActions,
  guards: mcBookingGuards,
}).createMachine({
  context: buildMcInitialContext,
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
          actions: "resetServiceDecisionsOnEdit",
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
        {
          type: "logStateEntry",
          params: { label: "Entered 'Requested' state" },
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
        {
          type: "logStateEntry",
          params: { label: "Entered 'Canceled' state" },
        },
        {
          type: "queueCancelProcessing",
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
          actions: "resetServiceDecisionsOnEdit",
        },
      },
      after: {
        "86400000": {
          target: "Canceled",
          actions: [
            { type: "setAutomationReason", params: { reason: "decline" } },
          ],
        },
      },
      entry: [
        {
          type: "logStateEntry",
          params: { label: "Entered 'Declined' state" },
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
        {
          type: "logStateEntry",
          params: { label: "Entered 'Approved' state" },
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
        {
          type: "logStateEntry",
          params: { label: "Entered 'Services Request' parallel state" },
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
                  guard: { type: "staffRequested" },
                },
                { target: "Staff Approved" },
              ],
              entry: [
                {
                  type: "logStateEntry",
                  params: { label: "Evaluating Staff Request" },
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
                {
                  type: "logStateEntry",
                  params: { label: "Staff Request Pending Approval" },
                },
              ],
            },
            "Staff Approved": {
              type: "final",
              entry: [
                {
                  type: "logStateEntry",
                  params: { label: "Staff Request APPROVED" },
                },
              ],
            },
            "Staff Declined": {
              type: "final",
              entry: [
                {
                  type: "logStateEntry",
                  params: { label: "Staff Request DECLINED" },
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
                  guard: { type: "caterRequested" },
                },
                { target: "Catering Approved" },
              ],
              entry: [
                {
                  type: "logStateEntry",
                  params: { label: "Evaluating Catering Request" },
                },
              ],
            },
            "Catering Requested": {
              on: {
                declineCatering: {
                  target: "Catering Declined",
                  actions: "declineCateringService",
                },
                approveCatering: {
                  target: "Catering Approved",
                  actions: "approveCateringService",
                },
              },
              entry: [
                {
                  type: "logStateEntry",
                  params: { label: "Catering Request Pending Approval" },
                },
              ],
            },
            "Catering Approved": {
              type: "final",
              entry: [
                {
                  type: "logStateEntry",
                  params: { label: "Catering Request APPROVED" },
                },
              ],
            },
            "Catering Declined": {
              type: "final",
              entry: [
                {
                  type: "logStateEntry",
                  params: { label: "Catering Request DECLINED" },
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
                  guard: { type: "setupRequested" },
                },
                { target: "Setup Approved" },
              ],
              entry: [
                {
                  type: "logStateEntry",
                  params: { label: "Evaluating Setup Request" },
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
                {
                  type: "logStateEntry",
                  params: { label: "Setup Request Pending Approval" },
                },
              ],
            },
            "Setup Approved": {
              type: "final",
              entry: [
                {
                  type: "logStateEntry",
                  params: { label: "Setup Request APPROVED" },
                },
              ],
            },
            "Setup Declined": {
              type: "final",
              entry: [
                {
                  type: "logStateEntry",
                  params: { label: "Setup Request DECLINED" },
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
                  guard: { type: "cleanRequested" },
                },
                { target: "Cleaning Approved" },
              ],
              entry: [
                {
                  type: "logStateEntry",
                  params: { label: "Evaluating Cleaning Request" },
                },
              ],
            },
            "Cleaning Requested": {
              on: {
                declineCleaning: {
                  target: "Cleaning Declined",
                  actions: "declineCleaningService",
                },
                approveCleaning: {
                  target: "Cleaning Approved",
                  actions: "approveCleaningService",
                },
              },
              entry: [
                {
                  type: "logStateEntry",
                  params: { label: "Cleaning Request Pending Approval" },
                },
              ],
            },
            "Cleaning Approved": {
              type: "final",
              entry: [
                {
                  type: "logStateEntry",
                  params: { label: "Cleaning Request APPROVED" },
                },
              ],
            },
            "Cleaning Declined": {
              type: "final",
              entry: [
                {
                  type: "logStateEntry",
                  params: { label: "Cleaning Request DECLINED" },
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
                  guard: { type: "securityRequested" },
                },
                { target: "Security Approved" },
              ],
              entry: [
                {
                  type: "logStateEntry",
                  params: { label: "Evaluating Security Request" },
                },
              ],
            },
            "Security Requested": {
              on: {
                declineSecurity: {
                  target: "Security Declined",
                  actions: "declineSecurityService",
                },
                approveSecurity: {
                  target: "Security Approved",
                  actions: "approveSecurityService",
                },
              },
              entry: [
                {
                  type: "logStateEntry",
                  params: { label: "Security Request Pending Approval" },
                },
              ],
            },
            "Security Approved": {
              type: "final",
              entry: [
                {
                  type: "logStateEntry",
                  params: { label: "Security Request APPROVED" },
                },
              ],
            },
            "Security Declined": {
              type: "final",
              entry: [
                {
                  type: "logStateEntry",
                  params: { label: "Security Request DECLINED" },
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
                  guard: { type: "equipRequested" },
                },
                { target: "Equipment Approved" },
              ],
              entry: [
                {
                  type: "logStateEntry",
                  params: { label: "Evaluating Equipment Request" },
                },
              ],
            },
            "Equipment Requested": {
              on: {
                declineEquipment: {
                  target: "Equipment Declined",
                  actions: "declineEquipmentService",
                },
                approveEquipment: {
                  target: "Equipment Approved",
                  actions: "approveEquipmentService",
                },
              },
              entry: [
                {
                  type: "logStateEntry",
                  params: { label: "Equipment Request Pending Approval" },
                },
              ],
            },
            "Equipment Approved": {
              type: "final",
              entry: [
                {
                  type: "logStateEntry",
                  params: { label: "Equipment Request APPROVED" },
                },
              ],
            },
            "Equipment Declined": {
              type: "final",
              entry: [
                {
                  type: "logStateEntry",
                  params: { label: "Equipment Request DECLINED" },
                },
              ],
            },
          },
        },
        "Furnishings Request": {
          initial: "Evaluate Furnishings Request",
          states: {
            "Evaluate Furnishings Request": {
              always: [
                {
                  target: "Furnishings Requested",
                  guard: { type: "furnishingsRequested" },
                },
                { target: "Furnishings Approved" },
              ],
              entry: [
                {
                  type: "logStateEntry",
                  params: { label: "Evaluating Furnishings Request" },
                },
              ],
            },
            "Furnishings Requested": {
              on: {
                declineFurnishings: {
                  target: "Furnishings Declined",
                  actions: "declineFurnishingsService",
                },
                approveFurnishings: {
                  target: "Furnishings Approved",
                  actions: "approveFurnishingsService",
                },
              },
              entry: [
                {
                  type: "logStateEntry",
                  params: { label: "Furnishings Request Pending Approval" },
                },
              ],
            },
            "Furnishings Approved": {
              type: "final",
              entry: [
                {
                  type: "logStateEntry",
                  params: { label: "Furnishings Request APPROVED" },
                },
              ],
            },
            "Furnishings Declined": {
              type: "final",
              entry: [
                {
                  type: "logStateEntry",
                  params: { label: "Furnishings Request DECLINED" },
                },
              ],
            },
          },
        },
      },
    },
    "Pre-approved": {
      on: {
        // Pregame bookings intentionally take the same path as user bookings
        // here: ones with services must pass service review (issue #1507),
        // only service-less ones batch-approve straight through.
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
        {
          type: "logStateEntry",
          params: { label: "Entered 'Pre-approved' state" },
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
        {
          type: "logStateEntry",
          params: { label: "Entered 'Service Closeout' parallel state" },
        },
      ],
      states: {
        "Staff Closeout": {
          initial: "Evaluate Staff",
          states: {
            "Evaluate Staff": {
              always: [
                {
                  target: "Staff Closeout Pending",
                  guard: { type: "staffApproved" },
                },
                { target: "Staff Closedout" },
              ],
              entry: [
                {
                  type: "logStateEntry",
                  params: { label: "Evaluating Staff Closeout" },
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
                {
                  type: "logStateEntry",
                  params: { label: "Staff Closeout Pending" },
                },
              ],
            },
            "Staff Closedout": {
              type: "final",
              entry: [
                {
                  type: "logStateEntry",
                  params: { label: "Staff CLOSED OUT" },
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
                  guard: { type: "cateringApproved" },
                },
                { target: "Catering Closedout" },
              ],
              entry: [
                {
                  type: "logStateEntry",
                  params: { label: "Evaluating Catering Closeout" },
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
                {
                  type: "logStateEntry",
                  params: { label: "Catering Closeout Pending" },
                },
              ],
            },
            "Catering Closedout": {
              type: "final",
              entry: [
                {
                  type: "logStateEntry",
                  params: { label: "Catering CLOSED OUT" },
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
                  guard: { type: "setupApproved" },
                },
                { target: "Setup Closedout" },
              ],
              entry: [
                {
                  type: "logStateEntry",
                  params: { label: "Evaluating Setup Closeout" },
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
                {
                  type: "logStateEntry",
                  params: { label: "Setup Closeout Pending" },
                },
              ],
            },
            "Setup Closedout": {
              type: "final",
              entry: [
                {
                  type: "logStateEntry",
                  params: { label: "Setup CLOSED OUT" },
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
                  guard: { type: "cleanApproved" },
                },
                { target: "Cleaning Closedout" },
              ],
              entry: [
                {
                  type: "logStateEntry",
                  params: { label: "Evaluating Cleaning Closeout" },
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
                {
                  type: "logStateEntry",
                  params: { label: "Cleaning Closeout Pending" },
                },
              ],
            },
            "Cleaning Closedout": {
              type: "final",
              entry: [
                {
                  type: "logStateEntry",
                  params: { label: "Cleaning CLOSED OUT" },
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
                  guard: { type: "securityApproved" },
                },
                { target: "Security Closedout" },
              ],
              entry: [
                {
                  type: "logStateEntry",
                  params: { label: "Evaluating Security Closeout" },
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
                {
                  type: "logStateEntry",
                  params: { label: "Security Closeout Pending" },
                },
              ],
            },
            "Security Closedout": {
              type: "final",
              entry: [
                {
                  type: "logStateEntry",
                  params: { label: "Security CLOSED OUT" },
                },
              ],
            },
          },
        },
        "Equipment Closeout": {
          initial: "Evaluate Equipment",
          states: {
            "Evaluate Equipment": {
              always: [
                {
                  target: "Equipment Closeout Pending",
                  guard: { type: "equipApproved" },
                },
                { target: "Equipment Closedout" },
              ],
              entry: [
                {
                  type: "logStateEntry",
                  params: { label: "Evaluating Equipment Closeout" },
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
                {
                  type: "logStateEntry",
                  params: { label: "Equipment Closeout Pending" },
                },
              ],
            },
            "Equipment Closedout": {
              type: "final",
              entry: [
                {
                  type: "logStateEntry",
                  params: { label: "Equipment CLOSED OUT" },
                },
              ],
            },
          },
        },
        "Furnishings Closeout": {
          initial: "Evaluate Furnishings",
          states: {
            "Evaluate Furnishings": {
              always: [
                {
                  target: "Furnishings Closeout Pending",
                  guard: { type: "furnishingsApproved" },
                },
                { target: "Furnishings Closedout" },
              ],
              entry: [
                {
                  type: "logStateEntry",
                  params: { label: "Evaluating Furnishings Closeout" },
                },
              ],
            },
            "Furnishings Closeout Pending": {
              on: {
                closeoutFurnishings: {
                  target: "Furnishings Closedout",
                },
              },
              entry: [
                {
                  type: "logStateEntry",
                  params: { label: "Furnishings Closeout Pending" },
                },
              ],
            },
            "Furnishings Closedout": {
              type: "final",
              entry: [
                {
                  type: "logStateEntry",
                  params: { label: "Furnishings CLOSED OUT" },
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
        {
          type: "logStateEntry",
          params: { label: "Entered 'Closed' state (final)" },
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
        {
          type: "logStateEntry",
          params: { label: "Entered 'Checked In' state" },
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
        actions: [
          { type: "setAutomationReason", params: { reason: "no-show" } },
        ],
      },
      entry: [
        { type: "logStateEntry", params: { label: "Entered 'No Show' state" } },
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
        {
          type: "logStateEntry",
          params: { label: "Evaluating Services Request Results" },
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
        {
          type: "logStateEntry",
          params: { label: "Entered 'Checked Out' state" },
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
