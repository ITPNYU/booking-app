import { BookingStatusLabel, PagePermission } from "../types";

/** History-table notes for each PRE-APPROVED stage. */
export const DEPARTMENTAL_LIAISON_APPROVED_NOTE =
  "Departmental Liaison Approved";
export const ADMIN_POLICY_APPROVED_NOTE = "Admin Policy Approved";

const SERVICE_HISTORY_DISPLAY_NAMES: Record<string, string> = {
  staff: "Staffing",
  equipment: "Equipment",
  catering: "Catering",
  cleaning: "Cleaning",
  security: "Security",
  setup: "Setup",
  furnishings: "Furnishings",
};

export function isBlankHistoryNote(note: unknown): boolean {
  return note == null || String(note).trim() === "";
}

export function isSystemHistoryActor(changedBy?: string): boolean {
  return !changedBy || changedBy.trim().toLowerCase() === "system";
}

/** History note for a first-approval PRE-APPROVED log based on the actor's role. */
export function firstApprovalHistoryNote(
  email?: string,
  role?: PagePermission,
): string | undefined {
  if (isSystemHistoryActor(email)) {
    return undefined;
  }
  if (role === PagePermission.ADMIN || role === PagePermission.SUPER_ADMIN) {
    return ADMIN_POLICY_APPROVED_NOTE;
  }
  return DEPARTMENTAL_LIAISON_APPROVED_NOTE;
}

export function serviceHistoryDisplayName(serviceType: string): string {
  return (
    SERVICE_HISTORY_DISPLAY_NAMES[serviceType] ??
    serviceType.charAt(0).toUpperCase() + serviceType.slice(1)
  );
}

export function serviceHistoryNote(
  serviceType: string,
  action: "approve" | "decline" | "closeout",
  reason?: string,
): string {
  const actionDisplayName =
    action === "approve"
      ? "Approved"
      : action === "decline"
        ? "Declined"
        : "Closed Out";
  const base = `${serviceHistoryDisplayName(serviceType)} Service ${actionDisplayName}`;
  if (action === "decline" && reason && String(reason).trim().length > 0) {
    return `${base}: ${reason}`;
  }
  return base;
}

export type HistoryLogNoteInput = {
  status: string;
  note?: unknown;
  changedBy?: string;
};

/**
 * Fill in liaison / admin policy notes for PRE-APPROVED logs that were stored
 * without one. Walks logs in the given (chronological) order:
 * - existing notes are kept
 * - a System PRE-APPROVED consumes the liaison slot (auto first-approve)
 * - labeled liaison / admin policy notes consume their slots
 * - service notes do not consume liaison / admin slots
 */
export function resolvePreApprovedHistoryNotes(
  logs: HistoryLogNoteInput[],
): (string | undefined)[] {
  let liaisonAssigned = false;
  let adminAssigned = false;

  return logs.map((log) => {
    const storedNote = isBlankHistoryNote(log.note)
      ? undefined
      : String(log.note);

    if (log.status !== BookingStatusLabel.PRE_APPROVED) {
      return storedNote;
    }

    if (storedNote) {
      if (storedNote === DEPARTMENTAL_LIAISON_APPROVED_NOTE) {
        liaisonAssigned = true;
      } else if (storedNote === ADMIN_POLICY_APPROVED_NOTE) {
        adminAssigned = true;
      }
      return storedNote;
    }

    if (isSystemHistoryActor(log.changedBy)) {
      liaisonAssigned = true;
      return undefined;
    }

    if (!liaisonAssigned) {
      liaisonAssigned = true;
      return DEPARTMENTAL_LIAISON_APPROVED_NOTE;
    }
    if (!adminAssigned) {
      adminAssigned = true;
      return ADMIN_POLICY_APPROVED_NOTE;
    }
    return undefined;
  });
}
