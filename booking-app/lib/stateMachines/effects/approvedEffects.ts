import * as admin from "firebase-admin";
import type { HandlerContext, StateHandler } from "./types";

/**
 * Handler for the `Approved` state entry.
 *
 * Side-effect footprint is intentionally minimal: the real approval
 * side effects (emails, calendar status update, user invite) are handled
 * by `/api/approve` → `finalApprove()` → `serverApproveEvent()` in the
 * endpoint layer, not here. This handler only stamps the final-approval
 * timestamps onto `firestoreUpdates` so the dispatcher persists them.
 */
export const handleApprovedEntry: StateHandler = async (
  ctx: HandlerContext,
) => {
  const { calendarEventId, email, tenant, previousState, newState, firestoreUpdates } = ctx;

  firestoreUpdates.finalApprovedAt = admin.firestore.Timestamp.now();
  if (email) {
    firestoreUpdates.finalApprovedBy = email;
  }

  console.log(
    `🎉 XSTATE REACHED APPROVED [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
    {
      calendarEventId,
      previousState,
      newState,
      finalApprovedAt: firestoreUpdates.finalApprovedAt,
      finalApprovedBy: firestoreUpdates.finalApprovedBy,
    },
  );

  console.log(
    `📝 XSTATE APPROVED STATE REACHED - SIDE EFFECTS HANDLED EXTERNALLY [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
    {
      calendarEventId,
      email,
      tenant,
      note: "Approval side effects handled by /api/services or /api/approve",
    },
  );
};
