import { DEFAULT_TENANT } from "@/components/src/constants/tenants";
import { getTenantEmailConfig } from "@/components/src/server/emails";
import { BookingStatusLabel } from "@/components/src/types";
import { BookingLogger } from "@/lib/logger/bookingLogger";
import * as admin from "firebase-admin";
import type { HandlerContext, StateHandler } from "./types";

/**
 * Fallback handler invoked when no per-state handler matches the new
 * state. Primarily handles XState parallel states (`Services Request`,
 * `Service Closeout`) and generic status-label mapping for string states
 * that aren't covered by a dedicated handler.
 *
 * For `Service Closeout` transitioned from `Checked In` (Media Commons),
 * this also sends the check-out email and updates the Google Calendar
 * event with the `[CHECKED_OUT]` prefix.
 */
export const handleFallbackEntry: StateHandler = async (
  ctx: HandlerContext,
) => {
  const {
    calendarEventId,
    email,
    tenant,
    previousState,
    newState,
    firestoreUpdates,
    bookingDoc,
    skipCalendarForServiceCloseout,
  } = ctx;

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
  let statusLabel: BookingStatusLabel | null | undefined;
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
    if ((newState as any)["Services Request"]) {
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
    } else if ((newState as any)["Service Closeout"]) {
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
              error: error instanceof Error ? error.message : String(error),
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
};
