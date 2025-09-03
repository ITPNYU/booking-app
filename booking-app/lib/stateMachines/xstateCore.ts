import { itpBookingMachine } from "./itpBookingMachine";
import { mcBookingMachine } from "./mcBookingMachine";

// Type for persisted XState data using v5 snapshot
export interface PersistedXStateData {
  snapshot: any; // XState v5 snapshot
  machineId: string;
  lastTransition: string;
}

/**
 * Map booking status to XState state
 */
export function mapBookingStatusToXState(status: string): string {
  const statusMap: { [key: string]: string } = {
    REQUESTED: "Requested",
    PENDING: "Requested", // PENDING maps to Requested in XState
    PRE_APPROVED: "Pre-approved",
    APPROVED: "Approved",
    DECLINED: "Declined",
    CANCELED: "Canceled",
    "CHECKED-IN": "Checked In",
    "CHECKED-OUT": "Checked Out",
    NO_SHOW: "Service Closeout",
    CLOSED: "Closed",
  };

  return statusMap[status] || "Requested";
}

/**
 * Get the appropriate machine for the tenant
 */
export function getMachineForTenant(tenant?: string) {
  // For now, assume MC tenant uses mcBookingMachine, others use itpBookingMachine
  if (tenant === "mc") {
    return mcBookingMachine;
  }
  return itpBookingMachine;
}

/**
 * Navigate actor to a specific state without triggering transitions
 */
export function navigateActorToState(actor: any, targetState: string): void {
  console.log(`🔧 MANUALLY SETTING XSTATE TO TARGET STATE:`, {
    fromState: actor.getSnapshot().value,
    toState: targetState,
    reason: "Skip transition side effects during XState creation",
  });

  // Get current snapshot
  const currentSnapshot = actor.getSnapshot();

  // Create new snapshot with target state
  const newSnapshot = {
    ...currentSnapshot,
    value: targetState,
  };

  // Manually set the actor's internal state
  (actor as any)._snapshot = newSnapshot;
}

/**
 * Clean object for Firestore storage (remove undefined values)
 */
export function cleanObjectForFirestore(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj
      .map(cleanObjectForFirestore)
      .filter((item) => item !== undefined);
  }

  if (typeof obj === "object") {
    const cleaned: any = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) {
        cleaned[key] = cleanObjectForFirestore(value);
      }
    }
    return cleaned;
  }

  return obj;
}

/**
 * Get booking status from booking data
 */
export function getBookingStatusFromData(bookingData: any): string {
  if (bookingData.finalApprovedAt) return "APPROVED";
  if (bookingData.firstApprovedAt) return "PRE_APPROVED";
  if (bookingData.declinedAt) return "DECLINED";
  if (bookingData.canceledAt) return "CANCELED";
  if (bookingData.checkedInAt) return "CHECKED-IN";
  if (bookingData.checkedOutAt) return "CHECKED-OUT";
  if (bookingData.noShowedAt) return "NO_SHOW";
  return "REQUESTED";
}
