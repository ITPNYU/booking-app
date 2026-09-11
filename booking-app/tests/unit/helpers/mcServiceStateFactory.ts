/**
 * Reference shape for one Media Commons service region.
 *
 * The production machine (lib/stateMachines/mcBookingMachine.ts) spells each
 * service region out as a literal so Stately Studio can import/export it.
 * This factory is the single description of what every region must look
 * like; mc-booking-machine-service-parity.unit.test.ts compares each literal
 * region against it so the six copies cannot drift.
 */
export interface McServiceConfig {
  /** Display name used in state keys, e.g. "Staff" → "Staff Request". */
  name: string;
  /** Key in context.servicesRequested / servicesApproved. */
  contextKey:
    | "staff"
    | "equipment"
    | "catering"
    | "cleaning"
    | "security"
    | "setup";
  requestGuard: string;
  approvedGuard: string;
  approveEvent: string;
  declineEvent: string;
  closeoutEvent: string;
  approveAction: string;
  declineAction: string;
}

export const MC_SERVICE_CONFIGS: readonly McServiceConfig[] = [
  {
    name: "Staff",
    contextKey: "staff",
    requestGuard: "staffRequested",
    approvedGuard: "staffApproved",
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
    approveEvent: "approveEquipment",
    declineEvent: "declineEquipment",
    closeoutEvent: "closeoutEquipment",
    approveAction: "approveEquipmentService",
    declineAction: "declineEquipmentService",
  },
];

const logEntry = (label: string) => [
  { type: "logStateEntry", params: { label } },
];

/** Expected literal for `"<Name> Request"` under the "Services Request" parallel state. */
export function expectedServiceRequestRegion(config: McServiceConfig) {
  const { name } = config;
  return {
    initial: `Evaluate ${name} Request`,
    states: {
      [`Evaluate ${name} Request`]: {
        always: [
          { target: `${name} Requested`, guard: { type: config.requestGuard } },
          { target: `${name} Approved` },
        ],
        entry: logEntry(`Evaluating ${name} Request`),
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
        entry: logEntry(`${name} Request Pending Approval`),
      },
      [`${name} Approved`]: {
        type: "final",
        entry: logEntry(`${name} Request APPROVED`),
      },
      [`${name} Declined`]: {
        type: "final",
        entry: logEntry(`${name} Request DECLINED`),
      },
    },
  };
}

/** Expected literal for `"<Name> Closeout"` under the "Service Closeout" parallel state. */
export function expectedServiceCloseoutRegion(config: McServiceConfig) {
  const { name } = config;
  return {
    initial: `Evaluate ${name}`,
    states: {
      [`Evaluate ${name}`]: {
        always: [
          {
            target: `${name} Closeout Pending`,
            guard: { type: config.approvedGuard },
          },
          { target: `${name} Closedout` },
        ],
        entry: logEntry(`Evaluating ${name} Closeout`),
      },
      [`${name} Closeout Pending`]: {
        on: {
          [config.closeoutEvent]: { target: `${name} Closedout` },
        },
        entry: logEntry(`${name} Closeout Pending`),
      },
      [`${name} Closedout`]: {
        type: "final",
        entry: logEntry(`${name} CLOSED OUT`),
      },
    },
  };
}
