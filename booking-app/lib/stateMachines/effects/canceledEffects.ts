import * as admin from "firebase-admin";
import type { HandlerContext, StateHandler } from "./types";

/**
 * Handler for the `Canceled` state entry.
 *
 * Stamps `canceledAt` / `canceledBy` onto `firestoreUpdates`. Calendar
 * deletion and cancel emails are handled by the calling API layer or
 * by downstream actors; this handler only records the audit fields.
 */
export const handleCanceledEntry: StateHandler = async (
  ctx: HandlerContext,
) => {
  const { calendarEventId, email, tenant, previousState, newState, firestoreUpdates } = ctx;

  firestoreUpdates.canceledAt = admin.firestore.Timestamp.now();
  if (email) {
    firestoreUpdates.canceledBy = email;
  }

  console.log(
    `🔄 XSTATE REACHED CANCELED [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
    {
      calendarEventId,
      previousState,
      newState,
      canceledAt: firestoreUpdates.canceledAt,
      canceledBy: firestoreUpdates.canceledBy,
    },
  );
};
