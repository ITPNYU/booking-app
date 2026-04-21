import * as admin from "firebase-admin";
import type { HandlerContext, StateHandler } from "./types";

/**
 * Handler for the `No Show` state entry.
 *
 * Stamps `noShowedAt` / `noShowedBy` onto `firestoreUpdates`. Calendar
 * updates and emails for no-show are handled by the calling API layer;
 * this handler only persists the audit fields.
 */
export const handleNoShowEntry: StateHandler = async (
  ctx: HandlerContext,
) => {
  const { calendarEventId, email, tenant, previousState, newState, firestoreUpdates } = ctx;

  firestoreUpdates.noShowedAt = admin.firestore.Timestamp.now();
  if (email) {
    firestoreUpdates.noShowedBy = email;
  }

  console.log(
    `🚫 XSTATE REACHED NO SHOW [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
    {
      calendarEventId,
      previousState,
      newState,
      noShowedAt: firestoreUpdates.noShowedAt,
      noShowedBy: firestoreUpdates.noShowedBy,
    },
  );
};
