/**
 * Unified state transition handler.
 *
 * All side effects are now handled by machine actions calling processing API routes:
 * - Approved: /api/approve → finalApprove()
 * - Pre-approved: /api/approve → serverFirstApproveOnly() + calendar update
 * - Declined: machine action → /api/decline-processing
 * - Canceled: machine action → /api/cancel-processing
 * - Checked In: machine action → /api/checkin-processing
 * - Checked Out: machine action → /api/checkout-processing
 * - Closed: machine action → /api/close-processing
 * - NoShow: handled inline in xstateTransitions.ts
 * - Services: /api/services
 *
 * This function now only logs transitions for debugging.
 */
export async function handleStateTransitions(
  currentSnapshot: any,
  newSnapshot: any,
  calendarEventId: string,
  email?: string,
  tenant?: string,
  firestoreUpdates: any = {},
  actor?: any,
  reason?: string,
) {
  const previousState =
    typeof currentSnapshot.value === "string"
      ? currentSnapshot.value
      : JSON.stringify(currentSnapshot.value);
  const newState =
    typeof newSnapshot.value === "string"
      ? newSnapshot.value
      : JSON.stringify(newSnapshot.value);

  // Skip if no state change
  if (previousState === newState) {
    return;
  }

  console.log(
    `[XState] transition ${previousState} → ${newState} [${tenant?.toUpperCase() || "UNKNOWN"}]`,
    { calendarEventId, email },
  );
}
