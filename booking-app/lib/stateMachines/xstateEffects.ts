import type { SchemaContextType } from "@/components/src/client/routes/components/SchemaProvider";
import { DEFAULT_TENANT } from "@/components/src/constants/tenants";
import { TableNames } from "@/components/src/policy";
import { getTenantEmailConfig } from "@/components/src/server/emails";
import { BookingStatusLabel } from "@/components/src/types";
import {
  serverGetDocumentById,
} from "@/lib/firebase/server/adminDb";
import { BookingLogger } from "@/lib/logger/bookingLogger";
import * as admin from "firebase-admin";
import type { PersistedXStateData, PreApprovalUpdateData } from "./xstateTypes";
import { cleanObjectForFirestore } from "./xstatePersistence";
import { handleApprovedEntry } from "./effects/approvedEffects";
import { handleCanceledEntry } from "./effects/canceledEffects";
import { handleCheckedInEntry } from "./effects/checkedInEffects";
import { handleClosedEntry } from "./effects/closedEffects";
import { handleDeclinedEntry } from "./effects/declinedEffects";
import { handleNoShowEntry } from "./effects/noShowEffects";
import { handleRequestedEntry } from "./effects/requestedEffects";
import type { HandlerContext, StateHandler } from "./effects/types";

// Registry of per-state entry handlers. As branches are extracted from
// the inline if-else chain in `handleStateTransitions`, their handlers
// land here and the corresponding branch is removed from the function.
const stateHandlers: Partial<Record<string, StateHandler>> = {
  "Approved": handleApprovedEntry,
  "Requested": handleRequestedEntry,
  "No Show": handleNoShowEntry,
  "Canceled": handleCanceledEntry,
  "Closed": handleClosedEntry,
  "Declined": handleDeclinedEntry,
  "Checked In": handleCheckedInEntry,
};

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
  // state and the previous state differs, delegate to it. Otherwise fall
  // through to the inline branches still living in this function.
  const extractedHandler =
    typeof newState === "string" && newState !== previousState
      ? stateHandlers[newState]
      : undefined;

  if (extractedHandler) {
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
    await extractedHandler(handlerCtx);
  } else if (newState === "Pre-approved" && previousState !== "Pre-approved") {
    // Pre-approved state handling
    firestoreUpdates.firstApprovedAt = admin.firestore.Timestamp.now();
    if (email) {
      firestoreUpdates.firstApprovedBy = email;
    }

    console.log(
      `⏳ XSTATE REACHED PRE-APPROVED [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
      {
        calendarEventId,
        previousState,
        newState,
        firstApprovedAt: firestoreUpdates.firstApprovedAt,
        firstApprovedBy: firestoreUpdates.firstApprovedBy,
      },
    );

    try {
      const { serverUpdateDataByCalendarEventId } =
        await import("@/components/src/server/admin");
      const { TableNames } = await import("@/components/src/policy");
      const preApprovalUpdateData: PreApprovalUpdateData = {
        firstApprovedAt:
          firestoreUpdates.firstApprovedAt as admin.firestore.Timestamp,
        ...(firestoreUpdates.firstApprovedBy
          ? { firstApprovedBy: firestoreUpdates.firstApprovedBy as string }
          : {}),
      };

      if (firestoreUpdates.xstateData) {
        preApprovalUpdateData.xstateData =
          firestoreUpdates.xstateData as PersistedXStateData;
      }

      await serverUpdateDataByCalendarEventId(
        TableNames.BOOKING,
        calendarEventId,
        preApprovalUpdateData,
        tenant,
      );

      console.log(
        `💾 PRE-APPROVED DATA SAVED TO DB BEFORE CALENDAR UPDATE [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
        {
          calendarEventId,
          savedFields: Object.keys(preApprovalUpdateData),
          hasXStateData: !!preApprovalUpdateData.xstateData,
        },
      );
    } catch (error) {
      console.error(
        `🚨 FAILED TO PRE-SAVE PRE-APPROVED DATA [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
        {
          calendarEventId,
          error: error instanceof Error ? error.message : String(error),
        },
      );
      // Don't throw - continue with calendar update even if DB save failed
    }

    // Update calendar event with PRE_APPROVED status
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_BASE_URL}/api/calendarEvents`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "x-tenant": tenant || DEFAULT_TENANT,
          },
          body: JSON.stringify({
            calendarEventId,
            newValues: { statusPrefix: BookingStatusLabel.PRE_APPROVED },
          }),
        },
      );

      if (response.ok) {
        console.log(
          `📅 XSTATE PRE-APPROVED CALENDAR UPDATED [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
          {
            calendarEventId,
            statusPrefix: BookingStatusLabel.PRE_APPROVED,
          },
        );
      } else {
        console.error(
          `🚨 XSTATE PRE-APPROVED CALENDAR UPDATE FAILED [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
          {
            calendarEventId,
            status: response.status,
            statusText: response.statusText,
          },
        );
      }
    } catch (error) {
      console.error(
        `🚨 XSTATE PRE-APPROVED CALENDAR UPDATE ERROR [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
        {
          calendarEventId,
          error: error.message,
        },
      );
    }
  } else {
    // Generic state change - still log to history for tracking
    console.log(
      `🔄 XSTATE GENERIC STATE CHANGE [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
      {
        calendarEventId,
        previousState,
        newState,
        email,
      },
    );

    // Try to map XState to BookingStatusLabel for generic states
    let statusLabel: BookingStatusLabel | undefined;
    if (typeof newState === "string") {
      switch (newState) {
        case "Requested":
          statusLabel = BookingStatusLabel.REQUESTED;
          break;
        case "No Show":
          statusLabel = BookingStatusLabel.NO_SHOW;
          break;
        default:
          break;
      }
    } else if (typeof newState === "object" && newState) {
      // Handle parallel states
      if (newState["Services Request"]) {
        statusLabel = BookingStatusLabel.PRE_APPROVED;
        console.log(
          `🔀 XSTATE PARALLEL STATE: Services Request [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
          {
            calendarEventId,
            previousState,
            newState,
            statusLabel,
          },
        );
      } else if (newState["Service Closeout"]) {
        statusLabel = BookingStatusLabel.CHECKED_OUT;
        console.log(
          `🔀 XSTATE PARALLEL STATE: Service Closeout [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
          {
            calendarEventId,
            previousState,
            newState,
            statusLabel,
            skipCalendarUpdate: skipCalendarForServiceCloseout,
          },
        );

        // Handle check-out email for Service Closeout state (Media Commons)
        if (previousState === "Checked In" && !skipCalendarForServiceCloseout) {
          console.log(
            `📧 SENDING CHECK-OUT EMAIL FOR SERVICE CLOSEOUT [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
            {
              calendarEventId,
              previousState,
              newState: "Service Closeout",
            },
          );

          // Set check-out timestamps for Firestore
          firestoreUpdates.checkedOutAt = admin.firestore.Timestamp.now();
          if (email) {
            firestoreUpdates.checkedOutBy = email;
          }

          // Send check-out email to guest
          try {
            // Use email from booking document (not from XState context)
            const guestEmail = bookingDoc?.email;

            console.log(
              `🔍 XSTATE SERVICE CLOSEOUT EMAIL DEBUG [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
              {
                calendarEventId,
                hasBookingDoc: !!bookingDoc,
                bookingDocKeys: bookingDoc ? Object.keys(bookingDoc) : [],
                guestEmail,
                guestEmailType: typeof guestEmail,
                bookingDocEmail: bookingDoc?.email,
              },
            );

            if (guestEmail) {
              const { serverSendBookingDetailEmail } =
                await import("@/components/src/server/admin");
              const emailConfig = await getTenantEmailConfig(tenant);
              const headerMessage =
                emailConfig.emailMessages.checkoutConfirmation;

              await serverSendBookingDetailEmail({
                calendarEventId,
                targetEmail: guestEmail,
                headerMessage,
                status: BookingStatusLabel.CHECKED_OUT,
                tenant,
              });

              console.log(
                `📧 XSTATE SERVICE CLOSEOUT EMAIL SENT [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
                {
                  calendarEventId,
                  guestEmail,
                },
              );
            } else {
              console.warn(
                `⚠️ XSTATE SERVICE CLOSEOUT EMAIL SKIPPED - NO EMAIL [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
                {
                  calendarEventId,
                  hasBookingDoc: !!bookingDoc,
                  bookingDocKeys: bookingDoc ? Object.keys(bookingDoc) : [],
                },
              );
            }
          } catch (error) {
            console.error(
              `🚨 XSTATE SERVICE CLOSEOUT EMAIL FAILED [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
              {
                calendarEventId,
                email,
                tenant,
                error: error.message,
              },
            );
          }

          // Update calendar event with CHECKED_OUT status
          try {
            const response = await fetch(
              `${process.env.NEXT_PUBLIC_BASE_URL}/api/calendarEvents`,
              {
                method: "PUT",
                headers: {
                  "Content-Type": "application/json",
                  "x-tenant": tenant || DEFAULT_TENANT,
                },
                body: JSON.stringify({
                  calendarEventId,
                  newValues: {
                    statusPrefix: BookingStatusLabel.CHECKED_OUT,
                  },
                }),
              },
            );

            if (response.ok) {
              BookingLogger.calendarUpdate(
                "Service Closeout status update",
                { calendarEventId, tenant },
                { statusPrefix: BookingStatusLabel.CHECKED_OUT },
              );
            }
          } catch (error) {
            BookingLogger.calendarError(
              "Service Closeout calendar update",
              { calendarEventId, tenant },
              error,
            );
          }
        }

        // Skip calendar update if this Service Closeout was triggered by No Show
        if (skipCalendarForServiceCloseout) {
          console.log(
            `⏭️ SKIPPING SERVICE CLOSEOUT CALENDAR UPDATE - HANDLED BY NO SHOW [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
            {
              calendarEventId,
              reason: "No Show processing already updated calendar",
            },
          );
          statusLabel = null; // Prevent generic history logging too
        }
      }
    }

    // Apply status label to Firestore updates if determined
    if (statusLabel) {
      firestoreUpdates.status = statusLabel;
      console.log(
        `📋 XSTATE STATUS UPDATE [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
        {
          calendarEventId,
          previousState,
          newState,
          statusLabel,
          willUpdateDatabaseStatus: true,
        },
      );
    }

    // Note: History logging is now handled by traditional functions only
    // XState only manages state transitions, not history logging
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
