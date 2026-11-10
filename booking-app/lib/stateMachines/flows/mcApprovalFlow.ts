import { approvalFlowSchema } from "@/components/src/client/routes/components/schemaTypes";

type ServiceConfig = {
  name: string;
  contextKey: string;
  requestGuard: string;
  approvedGuard: string;
  autoCloseoutGuard: string;
  alreadyApprovedGuard: string;
  alreadyDeclinedGuard: string;
  approveEvent: string;
  declineEvent: string;
  closeoutEvent: string;
  approveAction: string;
  declineAction: string;
};

const SERVICES: ServiceConfig[] = [
  {
    name: "Staff",
    contextKey: "staff",
    requestGuard: "staffRequested",
    approvedGuard: "staffApproved",
    autoCloseoutGuard: "staffAutoCloseout",
    alreadyApprovedGuard: "staffAlreadyApproved",
    alreadyDeclinedGuard: "staffAlreadyDeclined",
    approveEvent: "approveStaff",
    declineEvent: "declineStaff",
    closeoutEvent: "closeoutStaff",
    approveAction: "approveStaffService",
    declineAction: "declineStaffService",
  },
  {
    name: "Catering",
    contextKey: "catering",
    requestGuard: "caterRequested",
    approvedGuard: "cateringApproved",
    autoCloseoutGuard: "cateringAutoCloseout",
    alreadyApprovedGuard: "cateringAlreadyApproved",
    alreadyDeclinedGuard: "cateringAlreadyDeclined",
    approveEvent: "approveCatering",
    declineEvent: "declineCatering",
    closeoutEvent: "closeoutCatering",
    approveAction: "approveCateringService",
    declineAction: "declineCateringService",
  },
  {
    name: "Setup",
    contextKey: "setup",
    requestGuard: "setupRequested",
    approvedGuard: "setupApproved",
    autoCloseoutGuard: "setupAutoCloseout",
    alreadyApprovedGuard: "setupAlreadyApproved",
    alreadyDeclinedGuard: "setupAlreadyDeclined",
    approveEvent: "approveSetup",
    declineEvent: "declineSetup",
    closeoutEvent: "closeoutSetup",
    approveAction: "approveSetupService",
    declineAction: "declineSetupService",
  },
  {
    name: "Cleaning",
    contextKey: "cleaning",
    requestGuard: "cleanRequested",
    approvedGuard: "cleanApproved",
    autoCloseoutGuard: "cleaningAutoCloseout",
    alreadyApprovedGuard: "cleaningAlreadyApproved",
    alreadyDeclinedGuard: "cleaningAlreadyDeclined",
    approveEvent: "approveCleaning",
    declineEvent: "declineCleaning",
    closeoutEvent: "closeoutCleaning",
    approveAction: "approveCleaningService",
    declineAction: "declineCleaningService",
  },
  {
    name: "Security",
    contextKey: "security",
    requestGuard: "securityRequested",
    approvedGuard: "securityApproved",
    autoCloseoutGuard: "securityAutoCloseout",
    alreadyApprovedGuard: "securityAlreadyApproved",
    alreadyDeclinedGuard: "securityAlreadyDeclined",
    approveEvent: "approveSecurity",
    declineEvent: "declineSecurity",
    closeoutEvent: "closeoutSecurity",
    approveAction: "approveSecurityService",
    declineAction: "declineSecurityService",
  },
  {
    name: "Equipment",
    contextKey: "equipment",
    requestGuard: "equipRequested",
    approvedGuard: "equipApproved",
    autoCloseoutGuard: "equipmentAutoCloseout",
    alreadyApprovedGuard: "equipmentAlreadyApproved",
    alreadyDeclinedGuard: "equipmentAlreadyDeclined",
    approveEvent: "approveEquipment",
    declineEvent: "declineEquipment",
    closeoutEvent: "closeoutEquipment",
    approveAction: "approveEquipmentService",
    declineAction: "declineEquipmentService",
  },
  {
    name: "Furnishings",
    contextKey: "furnishings",
    requestGuard: "furnishingsRequested",
    approvedGuard: "furnishingsApproved",
    autoCloseoutGuard: "furnishingsAutoCloseout",
    alreadyApprovedGuard: "furnishingsAlreadyApproved",
    alreadyDeclinedGuard: "furnishingsAlreadyDeclined",
    approveEvent: "approveFurnishings",
    declineEvent: "declineFurnishings",
    closeoutEvent: "closeoutFurnishings",
    approveAction: "approveFurnishingsService",
    declineAction: "declineFurnishingsService",
  },
];

const log = (label: string) => [{ type: "logStateEntry" as const, params: { label } }];

function requestRegion(config: ServiceConfig) {
  const { name } = config;
  return {
    initial: `Evaluate ${name} Request`,
    states: {
      [`Evaluate ${name} Request`]: {
        always: [
          {
            target: `${name} Approved`,
            guard: config.alreadyApprovedGuard,
          },
          {
            target: `${name} Declined`,
            guard: config.alreadyDeclinedGuard,
          },
          { target: `${name} Requested`, guard: config.requestGuard },
          { target: `${name} Approved` },
        ],
        entry: log(`Evaluating ${name} Request`),
      },
      [`${name} Requested`]: {
        on: {
          [config.declineEvent]: {
            target: `${name} Declined`,
            actions: config.declineAction,
          },
          [config.approveEvent]: {
            target: `${name} Approved`,
            actions: config.approveAction,
          },
        },
        entry: log(`${name} Request Pending Approval`),
      },
      [`${name} Approved`]: {
        type: "final" as const,
        entry: log(`${name} Request APPROVED`),
      },
      [`${name} Declined`]: {
        type: "final" as const,
        entry: log(`${name} Request DECLINED`),
      },
    },
  };
}

function closeoutRegion(config: ServiceConfig) {
  const { name } = config;
  return {
    initial: `Evaluate ${name}`,
    states: {
      [`Evaluate ${name}`]: {
        always: [
          {
            target: `${name} Closedout`,
            guard: config.autoCloseoutGuard,
            actions: [
              {
                type: "queueAutoCloseout" as const,
                params: { service: config.contextKey },
              },
            ],
          },
          {
            target: `${name} Closeout Pending`,
            guard: config.approvedGuard,
          },
          { target: `${name} Closedout` },
        ],
        entry: log(`Evaluating ${name} Closeout`),
      },
      [`${name} Closeout Pending`]: {
        on: {
          [config.closeoutEvent]: { target: `${name} Closedout` },
        },
        entry: log(`${name} Closeout Pending`),
      },
      [`${name} Closedout`]: {
        type: "final" as const,
        entry: log(`${name} CLOSED OUT`),
      },
    },
  };
}

/** Media Commons booking graph, checked in so a document can omit it. */
export const mcApprovalFlow = approvalFlowSchema.parse({
  version: 1,
  id: "MC Booking Request",
  initial: "Requested",
  states: {
    Requested: {
      on: {
        cancel: { target: "Canceled" },
        decline: { target: "Declined" },
        edit: {
          target: "Requested",
          actions: "resetServiceDecisionsOnEdit",
        },
        approve: { target: "Pre-approved" },
      },
      always: [
        { target: "Approved", guard: "shouldAutoApprove" },
        {
          target: "Services Request",
          guard: "isVip AND servicesRequested",
        },
      ],
      entry: [
        ...log("Entered 'Requested' state"),
        { type: "sendHTMLEmail" },
        { type: "createCalendarEvent" },
      ],
    },
    Canceled: {
      always: [
        { target: "Service Closeout", guard: "servicesRequested" },
        { target: "Closed" },
      ],
      entry: [
        ...log("Entered 'Canceled' state"),
        { type: "queueCancelProcessing" },
        { type: "logCanceledAfterAutomaticTransition" },
      ],
    },
    Declined: {
      on: {
        cancel: { target: "Canceled" },
        edit: {
          target: "Requested",
          actions: "resetServiceDecisionsOnEdit",
        },
      },
      after: [
        {
          delayMs: 86400000,
          target: "Canceled",
          actions: [{ type: "setAutomationReason", params: { reason: "decline" } }],
        },
      ],
      entry: [
        ...log("Entered 'Declined' state"),
        { type: "sendHTMLEmail" },
        { type: "updateCalendarEvent" },
      ],
    },
    Approved: {
      on: {
        checkIn: { target: "Checked In" },
        cancel: { target: "Canceled" },
        decline: { target: "Declined" },
        noShow: { target: "No Show" },
        autoCloseScript: { target: "Closed" },
        Modify: { target: "Approved" },
      },
      entry: [
        ...log("Entered 'Approved' state"),
        { type: "sendHTMLEmail" },
        { type: "updateCalendarEvent" },
        { type: "inviteUserToCalendarEvent" },
      ],
    },
    "Services Request": {
      type: "parallel",
      on: {
        cancel: { target: "Canceled" },
        decline: { target: "Declined", actions: "setDeclineReason" },
      },
      onDone: { target: "Evaluate Services Request" },
      entry: log("Entered 'Services Request' parallel state"),
      states: Object.fromEntries(
        SERVICES.map((config) => [
          `${config.name} Request`,
          requestRegion(config),
        ]),
      ),
    },
    "Pre-approved": {
      on: {
        approve: [
          { target: "Approved", guard: "servicesApproved" },
          { target: "Services Request", guard: "servicesRequested" },
          { target: "Approved" },
        ],
        cancel: { target: "Canceled" },
        decline: { target: "Declined", actions: "setDeclineReason" },
        edit: { target: "Requested" },
      },
      entry: [
        ...log("Entered 'Pre-approved' state"),
        { type: "updateCalendarEvent" },
      ],
    },
    "Service Closeout": {
      type: "parallel",
      onDone: { target: "Closed" },
      entry: log("Entered 'Service Closeout' parallel state"),
      states: Object.fromEntries(
        SERVICES.map((config) => [
          `${config.name} Closeout`,
          closeoutRegion(config),
        ]),
      ),
    },
    Closed: {
      type: "final",
      entry: [
        ...log("Entered 'Closed' state (final)"),
        { type: "handleCloseProcessing" },
        { type: "sendHTMLEmail" },
        { type: "updateCalendarEvent" },
      ],
    },
    "Checked In": {
      on: { checkOut: { target: "Checked Out" } },
      entry: [
        ...log("Entered 'Checked In' state"),
        { type: "sendHTMLEmail" },
        { type: "updateCalendarEvent" },
      ],
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
      entry: [
        ...log("Entered 'No Show' state"),
        { type: "updateCalendarEvent" },
        {
          type: "logBookingHistory",
          params: { status: "NO-SHOW", note: "Booking marked as no show" },
        },
      ],
    },
    "Evaluate Services Request": {
      always: [
        { target: "Approved", guard: "servicesApproved" },
        { target: "Declined", guard: "servicesDeclined" },
      ],
      entry: log("Evaluating Services Request Results"),
    },
    "Checked Out": {
      always: [
        { target: "Service Closeout", guard: "servicesRequested" },
        { target: "Closed" },
      ],
      entry: [
        ...log("Entered 'Checked Out' state"),
        { type: "handleCheckoutProcessing" },
        { type: "sendHTMLEmail" },
        { type: "updateCalendarEvent" },
      ],
    },
  },
});
