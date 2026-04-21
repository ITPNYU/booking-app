import * as admin from "firebase-admin";
import { cleanObjectForFirestore } from "../xstatePersistence";
import type { HandlerContext, StateHandler } from "./types";

/**
 * Handler for the `Checked In` state entry.
 *
 * Stamps check-in timestamps and persists the XState snapshot into
 * Firestore so that `statusFromXState` resolves correctly after reload.
 * All other check-in processing (emails, calendar update, history log)
 * is handled by `/api/checkin-processing`, called by the client after
 * this dispatcher returns.
 */
export const handleCheckedInEntry: StateHandler = async (
  ctx: HandlerContext,
) => {
  const {
    calendarEventId,
    email,
    tenant,
    previousState,
    newState,
    firestoreUpdates,
    actor,
    currentSnapshot,
    newSnapshot,
  } = ctx;

  firestoreUpdates.checkedInAt = admin.firestore.Timestamp.now();
  if (email) {
    firestoreUpdates.checkedInBy = email;
  }

  console.log(
    `📥 XSTATE REACHED CHECKED IN [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
    {
      calendarEventId,
      previousState,
      newState,
      note: "checkin-processing will be called by client",
    },
  );

  // Persist XState snapshot so statusFromXState works correctly
  try {
    const { serverUpdateDataByCalendarEventId } =
      await import("@/components/src/server/admin");
    const { TableNames } = await import("@/components/src/policy");

    const persistedSnapshot = actor.getPersistedSnapshot();
    const cleanedSnapshot = cleanObjectForFirestore(persistedSnapshot);

    const xstateDataToPersist = {
      snapshot: cleanedSnapshot,
      machineId: newSnapshot?.machine?.id || currentSnapshot?.machine?.id,
      lastTransition: new Date().toISOString(),
    };

    await serverUpdateDataByCalendarEventId(
      TableNames.BOOKING,
      calendarEventId,
      {
        xstateData: xstateDataToPersist,
      },
      tenant,
    );

    console.log(
      `💾 XSTATE CHECK-IN: SNAPSHOT PERSISTED [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
      { calendarEventId, savedState: "Checked In" },
    );
  } catch (error) {
    console.error(
      `🚨 XSTATE CHECK-IN: FAILED TO PERSIST SNAPSHOT [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
      { calendarEventId, error: error instanceof Error ? error.message : String(error) },
    );
  }
};
