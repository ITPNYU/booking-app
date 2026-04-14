import { getTenantEmailConfig } from "@/components/src/server/emails";
import { BookingStatusLabel } from "@/components/src/types";
import { handleApprovedEntry } from "./effects/approvedEffects";
import { handleCanceledEntry } from "./effects/canceledEffects";
import { handleCheckedInEntry } from "./effects/checkedInEffects";
import { handleClosedEntry } from "./effects/closedEffects";
import { handleDeclinedEntry } from "./effects/declinedEffects";
import { handleFallbackEntry } from "./effects/fallbackEffects";
import { handleNoShowEntry } from "./effects/noShowEffects";
import { handlePreApprovedEntry } from "./effects/preApprovedEffects";
import { handleRequestedEntry } from "./effects/requestedEffects";
import type { HandlerContext, StateHandler } from "./effects/types";

// States that have a dedicated per-state handler. Any string state
// not in this union falls through to `handleFallbackEntry`.
type HandledState =
  | "Approved"
  | "Requested"
  | "No Show"
  | "Canceled"
  | "Closed"
  | "Declined"
  | "Checked In"
  | "Pre-approved";

// Registry of per-state entry handlers. Dispatcher delegates to one of
// these when `newState` is a string key present in the map. Otherwise
// the fallback handler runs (for XState parallel states and the
// catch-all generic status-label mapping).
//
// `satisfies` enforces that every key in HandledState is wired up —
// adding a new state to HandledState without adding a handler is a
// compile-time error. Keys must still be looked up with a string index
// since `newState` is typed `string`.
const stateHandlers = {
  "Approved": handleApprovedEntry,
  "Requested": handleRequestedEntry,
  "No Show": handleNoShowEntry,
  "Canceled": handleCanceledEntry,
  "Closed": handleClosedEntry,
  "Declined": handleDeclinedEntry,
  "Checked In": handleCheckedInEntry,
  "Pre-approved": handlePreApprovedEntry,
} satisfies Record<HandledState, StateHandler>;

// Note: History logging is now handled by traditional functions only
// XState only manages state transitions, not history logging
// Unified state transition handler with history logging
export async function handleStateTransitions(
  currentSnapshot: any,
  newSnapshot: any,
  calendarEventId: string,
  email: string,
  tenant: string,
  firestoreUpdates: any,
  actor: any,
  skipCalendarForServiceCloseout = false,
  isXStateCreation = false,
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
    console.log(
      `⏭️ SKIPPING HISTORY LOG - NO STATE CHANGE [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
      {
        calendarEventId,
        previousState,
        newState,
        reason: "Same state, no transition needed",
      },
    );
    return;
  }

  console.log(
    `🔄 XSTATE STATE TRANSITION DETECTED [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
    {
      calendarEventId,
      previousState,
      newState,
      email,
      willLogToHistory: false,
    },
  );

  // Get booking data from Firestore (not from XState context)
  let bookingDoc: any = null;
  try {
    const { serverGetDataByCalendarEventId } =
      await import("@/lib/firebase/server/adminDb");
    const { TableNames } = await import("@/components/src/policy");
    bookingDoc = await serverGetDataByCalendarEventId<any>(
      TableNames.BOOKING,
      calendarEventId,
      tenant,
    );
  } catch (error) {
    console.error(
      `🚨 ERROR GETTING BOOKING DATA FOR STATE TRANSITIONS [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
      {
        calendarEventId,
        error: error.message,
      },
    );
  }

  console.log(
    `🔄 XSTATE STATE TRANSITION DETECTED [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
    {
      calendarEventId,
      previousState,
      newState,
      email,
    },
  );

  // Per-state dispatch: if an extracted handler exists for this string
  // state and the previous state differs, delegate to it. Otherwise the
  // fallback handler runs (XState parallel states, generic status
  // mapping, and Service Closeout check-out email/calendar path).
  const extractedHandler =
    typeof newState === "string" && newState !== previousState
      ? (stateHandlers as Record<string, StateHandler>)[newState]
      : undefined;

  const handlerCtx: HandlerContext = {
    previousState,
    newState,
    currentSnapshot,
    newSnapshot,
    actor,
    calendarEventId,
    email,
    tenant,
    firestoreUpdates,
    bookingDoc,
    skipCalendarForServiceCloseout,
    isXStateCreation,
    reason,
  };

  if (extractedHandler) {
    await extractedHandler(handlerCtx);
  } else {
    await handleFallbackEntry(handlerCtx);
  }
}

/**
 * Helper function to send Canceled email
 */
export async function sendCanceledEmail(
  calendarEventId: string,
  email: string,
  tenant: string,
) {
  try {
    const { serverGetDataByCalendarEventId } =
      await import("@/lib/firebase/server/adminDb");
    const { serverSendBookingDetailEmail } =
      await import("@/components/src/server/admin");
    const { TableNames } = await import("@/components/src/policy");

    // Get booking document to get guest email
    const bookingDoc = await serverGetDataByCalendarEventId(
      TableNames.BOOKING,
      calendarEventId,
      tenant,
    );

    const guestEmail = (bookingDoc as any)?.email;

    if (guestEmail) {
      const emailConfig = await getTenantEmailConfig(tenant);
      const headerMessage = emailConfig.emailMessages.canceled;

      await serverSendBookingDetailEmail({
        calendarEventId,
        targetEmail: guestEmail,
        headerMessage,
        status: BookingStatusLabel.CANCELED,
        tenant,
      });

      console.log(
        `📧 CANCELED EMAIL SENT [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
        {
          calendarEventId,
          guestEmail,
        },
      );
    } else {
      console.warn(
        `⚠️ CANCELED EMAIL SKIPPED - NO EMAIL [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
        {
          calendarEventId,
        },
      );
    }
  } catch (error) {
    console.error(
      `🚨 CANCELED EMAIL FAILED [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
      {
        calendarEventId,
        error: error.message,
      },
    );
  }
}
