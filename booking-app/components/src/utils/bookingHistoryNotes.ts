import { PagePermission } from "../types";

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
 * Normalize stored history notes. Does not invent liaison / admin labels for
 * blank PRE-APPROVED rows: before this change those logs had no note, and a
 * first unlabeled human was often an Admin (or Super Admin), not a liaison.
 * New writes persist the role via firstApprovalHistoryNote.
 */
export function resolvePreApprovedHistoryNotes(
  logs: HistoryLogNoteInput[],
): (string | undefined)[] {
  return logs.map((log) =>
    isBlankHistoryNote(log.note) ? undefined : String(log.note),
  );
}
