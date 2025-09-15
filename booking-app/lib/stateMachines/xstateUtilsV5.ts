import { TENANTS } from "@/components/src/constants/tenants";
import { TableNames } from "@/components/src/policy";
import { serverUpdateDataByCalendarEventId } from "@/components/src/server/admin";
import { BookingStatusLabel } from "@/components/src/types";
import {
  getMediaCommonsServices,
  isMediaCommons,
  shouldUseXState,
} from "@/components/src/utils/tenantUtils";
import { serverGetDataByCalendarEventId } from "@/lib/firebase/server/adminDb";
import * as admin from "firebase-admin";
import { createActor } from "xstate";
import { itpBookingMachine } from "./itpBookingMachine";
import { mcBookingMachine } from "./mcBookingMachine";

// Type for persisted XState data using v5 snapshot
export interface PersistedXStateData {
  snapshot: any; // XState v5 snapshot object
  machineId: string;
  lastTransition: string;
}

// Note: History logging is now handled by traditional functions only
// XState only manages state transitions, not history logging
// Unified state transition handler with history logging
async function handleStateTransitions(
  currentSnapshot: any,
  newSnapshot: any,
  calendarEventId: string,
  email: string,
  tenant: string,
  firestoreUpdates: any,
  actor: any,
  skipCalendarForServiceCloseout = false,
  isXStateCreation = false,
  reason?: string
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
      }
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
    }
  );

  // Get booking data from Firestore (not from XState context)
  let bookingDoc: any = null;
  try {
    const { serverGetDataByCalendarEventId } = await import(
      "@/lib/firebase/server/adminDb"
    );
    const { TableNames } = await import("@/components/src/policy");
    bookingDoc = await serverGetDataByCalendarEventId<any>(
      TableNames.BOOKING,
      calendarEventId,
      tenant
    );
  } catch (error) {
    console.error(
      `🚨 ERROR GETTING BOOKING DATA FOR STATE TRANSITIONS [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
      {
        calendarEventId,
        error: error.message,
      }
    );
  }

  console.log(
    `🔄 XSTATE STATE TRANSITION DETECTED [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
    {
      calendarEventId,
      previousState,
      newState,
      email,
    }
  );

  // Handle specific state transitions
  if (newState === "Approved" && previousState !== "Approved") {
    // Approved state handling
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
      }
    );

    // Note: History logging is now handled by traditional functions only
    // XState only manages state transitions, not history logging

    // Note: Side effects (emails, calendar updates, history logging) are now handled
    // by traditional processing after XState transitions to maintain separation of concerns
    console.log(
      `📝 XSTATE APPROVED STATE REACHED - SIDE EFFECTS HANDLED EXTERNALLY [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
      {
        calendarEventId,
        email,
        tenant,
        note: "Approval side effects handled by /api/services or /api/approve",
      }
    );
  } else if (newState === "Declined" && previousState !== "Declined") {
    // Declined state handling
    firestoreUpdates.declinedAt = admin.firestore.Timestamp.now();
    if (email) {
      firestoreUpdates.declinedBy = email;
    }

    console.log(
      `❌ XSTATE REACHED DECLINED [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
      {
        calendarEventId,
        previousState,
        newState,
        declinedAt: firestoreUpdates.declinedAt,
        declinedBy: firestoreUpdates.declinedBy,
        reason: "Service(s) declined",
        servicesApproved: newSnapshot.context?.servicesApproved,
      }
    );

    // Note: History logging is now handled by traditional functions only
    // XState only manages state transitions, not history logging

    // Send decline email to guest using booking document email
    try {
      // Use email from booking document (not from XState context)
      const guestEmail = bookingDoc?.email;

      console.log(
        `🔍 XSTATE DECLINE EMAIL DEBUG [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
        {
          calendarEventId,
          hasNewSnapshot: !!newSnapshot,
          hasContext: !!newSnapshot.context,
          contextKeys: newSnapshot.context
            ? Object.keys(newSnapshot.context)
            : [],
          guestEmail,
          contextEmail: bookingDoc?.email,
        }
      );

      if (guestEmail) {
        const { serverSendBookingDetailEmail } = await import(
          "@/components/src/server/admin"
        );
        let headerMessage =
          "Your reservation request for Media Commons has been declined.";

        // Check which services were declined and include them in the message
        const declinedServices = [];
        if (newSnapshot.context?.servicesApproved) {
          const servicesApproved = newSnapshot.context.servicesApproved;
          const servicesRequested = newSnapshot.context.servicesRequested || {};

          Object.entries(servicesApproved).forEach(([service, approved]) => {
            if (servicesRequested[service] && approved === false) {
              // Capitalize first letter of service name
              const serviceName =
                service.charAt(0).toUpperCase() + service.slice(1);
              declinedServices.push(serviceName);
            }
          });
        }

        // Use decline reason from XState context if available, fallback to reason parameter
        let declineReason =
          newSnapshot.context?.declineReason ||
          reason ||
          "Service requirements could not be fulfilled";

        // If specific services were declined, include them in the reason
        if (declinedServices.length > 0) {
          const servicesList = declinedServices.join(", ");
          declineReason = `The following service(s) could not be fulfilled: ${servicesList}`;
        }

        headerMessage += ` Reason: ${declineReason}. <br /><br />If you have any questions or need further assistance, please don't hesitate to reach out.`;

        await serverSendBookingDetailEmail({
          calendarEventId,
          targetEmail: guestEmail,
          headerMessage,
          status: BookingStatusLabel.DECLINED,
          tenant,
        });

        console.log(
          `📧 XSTATE DECLINE EMAIL SENT [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
          {
            calendarEventId,
            guestEmail,
            reason: declineReason,
          }
        );
      } else {
        console.warn(
          `⚠️ XSTATE DECLINE EMAIL SKIPPED - NO EMAIL IN CONTEXT [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
          {
            calendarEventId,
            contextKeys: newSnapshot.context
              ? Object.keys(newSnapshot.context)
              : [],
          }
        );
      }
    } catch (error) {
      console.error(
        `🚨 XSTATE DECLINE EMAIL FAILED [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
        {
          calendarEventId,
          email,
          tenant,
          error: error.message,
        }
      );
    }

    // Update calendar event with DECLINED status
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_BASE_URL}/api/calendarEvents`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "x-tenant": tenant || "mc",
          },
          body: JSON.stringify({
            calendarEventId,
            newValues: { statusPrefix: BookingStatusLabel.DECLINED },
          }),
        }
      );

      if (response.ok) {
        console.log(
          `📅 XSTATE DECLINE CALENDAR UPDATED [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
          {
            calendarEventId,
            statusPrefix: BookingStatusLabel.DECLINED,
          }
        );
      } else {
        console.error(
          `🚨 XSTATE DECLINE CALENDAR UPDATE FAILED [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
          {
            calendarEventId,
            status: response.status,
            statusText: response.statusText,
          }
        );
      }
    } catch (error) {
      console.error(
        `🚨 XSTATE DECLINE CALENDAR UPDATE ERROR [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
        {
          calendarEventId,
          error: error.message,
        }
      );
    }
  } else if (newState === "Requested" && previousState !== "Requested") {
    // Requested state handling
    console.log(
      `🔄 XSTATE REACHED REQUESTED [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
      {
        calendarEventId,
        previousState,
        newState,
        note: "Decline field cleanup handled by calling API",
      }
    );

    // Note: History logging, calendar updates, and field cleanup are now handled by traditional functions only
    // XState only manages state transitions, not side effects
  } else if (newState === "No Show" && previousState !== "No Show") {
    // No Show state handling - update Firestore fields
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
      }
    );
  } else if (newState === "Canceled" && previousState !== "Canceled") {
    // Canceled state handling - update Firestore fields
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
      }
    );
  } else if (newState === "Closed" && previousState !== "Closed") {
    // Close processing is now handled by XState machine actions
    // Skip processing here to avoid duplication
    console.log(
      `🎯 XSTATE REACHED CLOSED [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
      {
        calendarEventId,
        previousState,
        newState,
        note: "Close processing handled by XState action",
      }
    );

    // Close processing is now handled by XState machine action calling /api/close-processing
    // All close-related operations (logging, email, calendar update) are handled by the API
  } else if (newState === "Canceled" && previousState !== "Canceled") {
    // Canceled state handling
    firestoreUpdates.canceledAt = admin.firestore.Timestamp.now();

    // For automatic transitions from No Show, attribute to System, not the user
    const isAutomaticFromNoShow = previousState === "No Show";
    if (isAutomaticFromNoShow) {
      firestoreUpdates.canceledBy = "System";
    } else if (email) {
      firestoreUpdates.canceledBy = email;
    }

    console.log(
      `🚫 XSTATE REACHED CANCELED [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
      {
        calendarEventId,
        previousState,
        newState,
        canceledAt: firestoreUpdates.canceledAt,
        canceledBy: firestoreUpdates.canceledBy,
        isAutomaticFromNoShow,
      }
    );

    // Add history logging for Canceled state
    try {
      const { serverSaveDataToFirestore } = await import(
        "@/lib/firebase/server/adminDb"
      );
      const { TableNames } = await import("@/components/src/policy");

      // For automatic transitions from No Show, attribute to System
      const changedBy = isAutomaticFromNoShow ? "System" : email || "system";

      const historyEntry = {
        calendarEventId,
        status: BookingStatusLabel.CANCELED,
        changedBy,
        changedAt: admin.firestore.Timestamp.now(),
        note:
          previousState === "No Show"
            ? "Canceled due to no show"
            : "Booking canceled",
        requestNumber: bookingDoc?.requestNumber || 0,
      };

      await serverSaveDataToFirestore(
        TableNames.BOOKING_LOGS,
        historyEntry,
        tenant
      );

      console.log(
        `📋 XSTATE CANCELED HISTORY LOGGED [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
        {
          calendarEventId,
          status: BookingStatusLabel.CANCELED,
          changedBy,
          note: historyEntry.note,
          isAutomaticFromNoShow,
        }
      );
    } catch (error) {
      console.error(
        `🚨 XSTATE CANCELED HISTORY LOGGING FAILED [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
        {
          calendarEventId,
          error: error.message,
        }
      );
    }

    // Cancel processing is now handled by XState machine actions
    // Skip processing here to avoid duplication
    console.log(
      `🎯 XSTATE REACHED CANCELED [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
      {
        calendarEventId,
        previousState,
        newState,
        note: "Cancel processing handled by XState action",
      }
    );
  } else if (newState === "Checked In" && previousState !== "Checked In") {
    // Check-in state handling
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
        checkedInAt: firestoreUpdates.checkedInAt,
        checkedInBy: firestoreUpdates.checkedInBy,
      }
    );

    // Note: History logging is now handled by traditional functions only
    // XState only manages state transitions, not history logging

    // Email sending is handled after history logging in db.ts (checkin)

    // Persist latest XState snapshot and checked-in timestamps BEFORE calendar update
    try {
      const { serverUpdateDataByCalendarEventId } = await import(
        "@/components/src/server/admin"
      );
      const { TableNames } = await import("@/components/src/policy");

      // Get persisted snapshot from the new state to avoid circular references
      const persistedSnapshot = actor.getPersistedSnapshot();

      // Clean snapshot by removing undefined values for Firestore compatibility
      const cleanedSnapshot = cleanObjectForFirestore(persistedSnapshot);

      const xstateDataToPersist = {
        snapshot: cleanedSnapshot, // persist cleaned snapshot for statusFromXState
        machineId: newSnapshot?.machine?.id || currentSnapshot?.machine?.id,
        lastTransition: new Date().toISOString(),
      };

      await serverUpdateDataByCalendarEventId(
        TableNames.BOOKING,
        calendarEventId,
        {
          xstateData: xstateDataToPersist,
          checkedInAt: firestoreUpdates.checkedInAt,
          checkedInBy: firestoreUpdates.checkedInBy,
        },
        tenant
      );

      console.log(
        `💾 XSTATE CHECK-IN: STATE PERSISTED BEFORE CAL UPDATE [${
          tenant?.toUpperCase() || "UNKNOWN"
        }]:`,
        {
          calendarEventId,
          savedState: "Checked In",
        }
      );
    } catch (error) {
      console.error(
        `🚨 XSTATE CHECK-IN: FAILED TO PERSIST BEFORE CAL UPDATE [${
          tenant?.toUpperCase() || "UNKNOWN"
        }]:`,
        { calendarEventId, error: (error as any)?.message }
      );
    }

    // Update calendar event with CHECKED_IN status
    // Status will be read from XState data in bookingContentsToDescription
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_BASE_URL}/api/calendarEvents`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "x-tenant": tenant || "mc",
          },
          body: JSON.stringify({
            calendarEventId,
            newValues: { statusPrefix: BookingStatusLabel.CHECKED_IN },
          }),
        }
      );

      if (response.ok) {
        console.log(
          `📅 XSTATE CHECK-IN CALENDAR UPDATED [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
          {
            calendarEventId,
            statusPrefix: BookingStatusLabel.CHECKED_IN,
            note: "Status will be read from XState data",
          }
        );
      }
    } catch (error) {
      console.error(
        `🚨 XSTATE CHECK-IN CALENDAR UPDATE ERROR [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
        {
          calendarEventId,
          error: error.message,
        }
      );
    }
  } else if (newState === "Checked Out" && previousState !== "Checked Out") {
    // Check-out state handling
    firestoreUpdates.checkedOutAt = admin.firestore.Timestamp.now();
    if (email) {
      firestoreUpdates.checkedOutBy = email;
    }

    console.log(
      `📤 XSTATE REACHED CHECKED OUT [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
      {
        calendarEventId,
        previousState,
        newState,
        checkedOutAt: firestoreUpdates.checkedOutAt,
        checkedOutBy: firestoreUpdates.checkedOutBy,
      }
    );

    // Note: History logging is now handled by traditional functions only
    // XState only manages state transitions, not history logging

    // Send check-out email to guest and update calendar
    try {
      // Use email from booking document (not from XState context)
      const guestEmail = bookingDoc?.email;

      console.log(
        `🔍 XSTATE CHECK-OUT EMAIL DEBUG [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
        {
          calendarEventId,
          hasBookingDoc: !!bookingDoc,
          bookingDocKeys: bookingDoc ? Object.keys(bookingDoc) : [],
          guestEmail,
          guestEmailType: typeof guestEmail,
          bookingDocEmail: bookingDoc?.email,
        }
      );

      if (guestEmail) {
        const { serverSendBookingDetailEmail } = await import(
          "@/components/src/server/admin"
        );
        const headerMessage =
          "Your reservation request for Media Commons has been checked out. Thank you for choosing Media Commons.";

        await serverSendBookingDetailEmail({
          calendarEventId,
          targetEmail: guestEmail,
          headerMessage,
          status: BookingStatusLabel.CHECKED_OUT,
          tenant,
        });

        console.log(
          `📧 XSTATE CHECK-OUT EMAIL SENT [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
          {
            calendarEventId,
            guestEmail,
          }
        );
      } else {
        console.warn(
          `⚠️ XSTATE CHECK-OUT EMAIL SKIPPED - NO EMAIL IN CONTEXT [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
          {
            calendarEventId,
            contextKeys: newSnapshot.context
              ? Object.keys(newSnapshot.context)
              : [],
          }
        );
      }
    } catch (error) {
      console.error(
        `🚨 XSTATE CHECK-OUT EMAIL FAILED [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
        {
          calendarEventId,
          email,
          tenant,
          error: error.message,
        }
      );
    }

    // Update calendar event with CHECKED_OUT status (including end time)
    // Status will be read from XState data in bookingContentsToDescription
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_BASE_URL}/api/calendarEvents`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "x-tenant": tenant || "mc",
          },
          body: JSON.stringify({
            calendarEventId,
            newValues: {
              statusPrefix: BookingStatusLabel.CHECKED_OUT,
              end: {
                dateTime: new Date().toISOString(),
              },
            },
          }),
        }
      );

      if (response.ok) {
        console.log(
          `📅 XSTATE CHECK-OUT CALENDAR UPDATED [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
          {
            calendarEventId,
            statusPrefix: BookingStatusLabel.CHECKED_OUT,
            note: "Status will be read from XState data",
          }
        );
      }
    } catch (error) {
      console.error(
        `🚨 XSTATE CHECK-OUT CALENDAR UPDATE ERROR [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
        {
          calendarEventId,
          error: error.message,
        }
      );
    }
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
      }
    );

    // Note: History logging is now handled by traditional functions only
    // XState only manages state transitions, not history logging

    // Note: Email sending and history logging for PRE_APPROVED is now handled by /api/approve
    // XState only manages state transitions, not side effects

    // Update calendar event with PRE_APPROVED status
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_BASE_URL}/api/calendarEvents`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "x-tenant": tenant || "mc",
          },
          body: JSON.stringify({
            calendarEventId,
            newValues: { statusPrefix: BookingStatusLabel.PRE_APPROVED },
          }),
        }
      );

      if (response.ok) {
        console.log(
          `📅 XSTATE PRE-APPROVED CALENDAR UPDATED [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
          {
            calendarEventId,
            statusPrefix: BookingStatusLabel.PRE_APPROVED,
          }
        );
      } else {
        console.error(
          `🚨 XSTATE PRE-APPROVED CALENDAR UPDATE FAILED [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
          {
            calendarEventId,
            status: response.status,
            statusText: response.statusText,
          }
        );
      }
    } catch (error) {
      console.error(
        `🚨 XSTATE PRE-APPROVED CALENDAR UPDATE ERROR [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
        {
          calendarEventId,
          error: error.message,
        }
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
      }
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
          }
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
          }
        );

        // Handle check-out email for Service Closeout state (Media Commons)
        if (previousState === "Checked In" && !skipCalendarForServiceCloseout) {
          console.log(
            `📧 SENDING CHECK-OUT EMAIL FOR SERVICE CLOSEOUT [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
            {
              calendarEventId,
              previousState,
              newState: "Service Closeout",
            }
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
              }
            );

            if (guestEmail) {
              const { serverSendBookingDetailEmail } = await import(
                "@/components/src/server/admin"
              );
              const headerMessage =
                "Your reservation request for Media Commons has been checked out. Thank you for choosing Media Commons.";

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
                }
              );
            } else {
              console.warn(
                `⚠️ XSTATE SERVICE CLOSEOUT EMAIL SKIPPED - NO EMAIL [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
                {
                  calendarEventId,
                  hasBookingDoc: !!bookingDoc,
                  bookingDocKeys: bookingDoc ? Object.keys(bookingDoc) : [],
                }
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
              }
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
                  "x-tenant": tenant || "mc",
                },
                body: JSON.stringify({
                  calendarEventId,
                  newValues: {
                    statusPrefix: BookingStatusLabel.CHECKED_OUT,
                  },
                }),
              }
            );

            if (response.ok) {
              console.log(
                `📅 XSTATE SERVICE CLOSEOUT CALENDAR UPDATED [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
                {
                  calendarEventId,
                  statusPrefix: BookingStatusLabel.CHECKED_OUT,
                }
              );
            }
          } catch (error) {
            console.error(
              `🚨 XSTATE SERVICE CLOSEOUT CALENDAR UPDATE ERROR [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
              {
                calendarEventId,
                error: error.message,
              }
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
            }
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
        }
      );
    }

    // Note: History logging is now handled by traditional functions only
    // XState only manages state transitions, not history logging
  }
}

/**
 * Map booking status to XState state
 */
function mapBookingStatusToXState(status: string): string {
  switch (status) {
    case BookingStatusLabel.REQUESTED:
      return "Requested";
    case BookingStatusLabel.APPROVED:
      return "Approved";
    case BookingStatusLabel.PRE_APPROVED:
      return "Pre-approved";
    case BookingStatusLabel.DECLINED:
      return "Declined";
    case BookingStatusLabel.CANCELED:
      return "Canceled";
    case BookingStatusLabel.CHECKED_IN:
      return "Checked In";
    case BookingStatusLabel.CHECKED_OUT:
      return "Checked Out";
    case BookingStatusLabel.NO_SHOW:
      return "No Show";
    default:
      console.warn(
        `Unknown booking status: ${status}, defaulting to Requested`
      );
      return "Requested";
  }
}

/**
 * Get the appropriate machine for a tenant
 */
function getMachineForTenant(tenant?: string) {
  switch (tenant) {
    case TENANTS.MC:
      return mcBookingMachine;
    case TENANTS.ITP:
      return itpBookingMachine;
    default:
      return itpBookingMachine; // default to ITP
  }
}

/**
 * Navigate actor to target state from initial state
 */

/**
 * Create and save XState data from booking status using v5 snapshot
 */
export async function createXStateDataFromBookingStatus(
  calendarEventId: string,
  bookingData: any,
  tenant?: string
): Promise<PersistedXStateData> {
  console.log(
    `🏗️ CREATING XSTATE DATA FROM BOOKING STATUS [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
    {
      calendarEventId,
      tenant,
    }
  );

  const machine = getMachineForTenant(tenant);
  const bookingStatus = getBookingStatusFromData(bookingData);
  const xstateState = mapBookingStatusToXState(bookingStatus);

  // Build input context
  const servicesRequested = isMediaCommons(tenant)
    ? getMediaCommonsServices(bookingData)
    : {};

  console.log(
    `🔍 XSTATE CONTEXT DEBUG [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
    {
      calendarEventId,
      bookingDataKeys: Object.keys(bookingData || {}),
      servicesRequestedResult: servicesRequested,
      bookingDataServiceFields: {
        roomSetup: bookingData?.roomSetup,
        staffingServicesDetails: bookingData?.staffingServicesDetails,
        equipmentServices: bookingData?.equipmentServices,
        catering: bookingData?.catering,
        cleaningService: bookingData?.cleaningService,
        hireSecurity: bookingData?.hireSecurity,
      },
    }
  );

  const inputContext = isMediaCommons(tenant)
    ? {
        tenant,
        selectedRooms: bookingData.selectedRooms || [], // Default to empty array
        bookingCalendarInfo: {
          startStr: bookingData.startDate?.toDate?.()?.toISOString(),
          endStr: bookingData.endDate?.toDate?.()?.toISOString(),
        },
        isWalkIn: bookingData.origin === "walk-in" || !!bookingData.walkedInAt,
        calendarEventId,
        email: bookingData.email,
        isVip: bookingData.isVip || false,
        servicesRequested,
        servicesApproved: {
          staff: bookingData.staffServiceApproved,
          equipment: bookingData.equipmentServiceApproved,
          catering: bookingData.cateringServiceApproved,
          cleaning: bookingData.cleaningServiceApproved,
          security: bookingData.securityServiceApproved,
          setup: bookingData.setupServiceApproved,
        },
        // Flag to indicate this XState was created from existing booking without prior xstateData
        _restoredFromStatus: true,
      }
    : {
        tenant,
        selectedRooms: bookingData.selectedRooms || [], // Default to empty array
        bookingCalendarInfo: {
          startStr: bookingData.startDate?.toDate?.()?.toISOString(),
          endStr: bookingData.endDate?.toDate?.()?.toISOString(),
        },
        isWalkIn: bookingData.origin === "walk-in" || !!bookingData.walkedInAt,
        calendarEventId,
        email: bookingData.email,
        // Flag to indicate this XState was created from existing booking without prior xstateData
        _restoredFromStatus: true,
      };

  // Create actor starting from the target state directly (without transitions)
  console.log(
    `🎯 CREATING XSTATE DIRECTLY IN TARGET STATE [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
    {
      calendarEventId,
      targetState: xstateState,
      bookingStatus,
    }
  );

  // Create actor directly in target state without executing transitions
  const actor = createActor(machine, {
    input: inputContext,
  });
  actor.start();

  // Manually set the state to target without triggering transitions
  // This prevents automatic history logging during XState creation
  if (xstateState !== "Requested") {
    console.log(
      `🔧 MANUALLY SETTING XSTATE TO TARGET STATE [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
      {
        calendarEventId,
        fromState: "Requested",
        toState: xstateState,
        reason: "Skip transition side effects during XState creation",
      }
    );

    // Use internal method to set state without triggering side effects
    // This is safe for XState creation from existing booking status
    const currentSnapshot = actor.getSnapshot();
    const newSnapshot = {
      ...currentSnapshot,
      value: xstateState,
    };

    // Update the actor's internal state directly
    (actor as any)._snapshot = newSnapshot;
  }

  // Get the persisted snapshot using XState v5 method
  const persistedSnapshot = actor.getPersistedSnapshot();

  console.log(
    `🔍 RAW PERSISTED SNAPSHOT [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
    {
      calendarEventId,
      hasSnapshot: !!persistedSnapshot,
      snapshotKeys: persistedSnapshot ? Object.keys(persistedSnapshot) : [],
      snapshotPreview: persistedSnapshot
        ? {
            status: persistedSnapshot.status,
            value: (persistedSnapshot as any).value,
            hasContext: !!(persistedSnapshot as any).context,
          }
        : null,
    }
  );

  // Clean snapshot by removing undefined values for Firestore compatibility
  const cleanSnapshot = cleanObjectForFirestore(persistedSnapshot);

  console.log(`🧹 CLEANED SNAPSHOT [${tenant?.toUpperCase() || "UNKNOWN"}]:`, {
    calendarEventId,
    hasCleanSnapshot: !!cleanSnapshot,
    cleanSnapshotKeys: cleanSnapshot ? Object.keys(cleanSnapshot) : [],
  });

  // Create XState data using proper v5 snapshot
  const xstateData: PersistedXStateData = {
    snapshot: cleanSnapshot,
    machineId: machine.id,
    lastTransition: new Date().toISOString(),
  };

  actor.stop();

  // Save the created XState data to Firestore
  await serverUpdateDataByCalendarEventId(
    TableNames.BOOKING,
    calendarEventId,
    { xstateData },
    tenant
  );

  console.log(
    `💾 XSTATE DATA CREATED AND SAVED [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
    {
      calendarEventId,
      createdState: xstateState,
      machineId: xstateData.machineId,
    }
  );

  return xstateData;
}

/**
 * Restore XState actor from persisted snapshot
 */
export async function restoreXStateFromFirestore(
  calendarEventId: string,
  tenant?: string
): Promise<any> {
  try {
    console.log(
      `🔄 RESTORING XSTATE FROM FIRESTORE [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
      {
        calendarEventId,
        tenant,
      }
    );

    // Get booking data from Firestore
    // Try tenant-specific collection first, then fallback to legacy bookings collection
    let bookingData = await serverGetDataByCalendarEventId(
      TableNames.BOOKING,
      calendarEventId,
      tenant
    );

    let actualTenant = tenant;

    // If not found in tenant collection, try legacy bookings collection (no tenant)
    if (!bookingData && tenant) {
      console.log(
        `🔍 BOOKING NOT FOUND IN TENANT COLLECTION, TRYING LEGACY [${tenant?.toUpperCase()}]:`,
        {
          calendarEventId,
          triedTenant: tenant,
        }
      );

      bookingData = await serverGetDataByCalendarEventId(
        TableNames.BOOKING,
        calendarEventId,
        undefined // No tenant for legacy bookings
      );

      if (bookingData) {
        actualTenant = undefined; // Use undefined for legacy bookings
        console.log(`✅ FOUND LEGACY BOOKING [${tenant?.toUpperCase()}]:`, {
          calendarEventId,
          usingLegacyCollection: true,
        });
      }
    }

    if (
      !bookingData ||
      !("xstateData" in bookingData) ||
      !bookingData.xstateData
    ) {
      console.log(
        `❌ NO XSTATE DATA FOUND IN FIRESTORE [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
        {
          calendarEventId,
          hasBookingData: !!bookingData,
          hasXStateData: !!(
            bookingData &&
            "xstateData" in bookingData &&
            bookingData.xstateData
          ),
        }
      );

      // Try to create XState data from booking status
      if (bookingData) {
        try {
          const xstateData = await createXStateDataFromBookingStatus(
            calendarEventId,
            bookingData,
            actualTenant // Use actualTenant instead of tenant
          );

          const machine = getMachineForTenant(tenant);

          // Create actor with persisted snapshot
          const restoredActor = createActor(machine, {
            snapshot: xstateData.snapshot,
          });

          console.log(
            `✅ XSTATE ACTOR CREATED FROM BOOKING STATUS [${tenant?.toUpperCase()}]:`,
            {
              calendarEventId,
              machineId: xstateData.machineId,
            }
          );

          return restoredActor;
        } catch (error) {
          console.error(
            `🚨 ERROR CREATING XSTATE FROM BOOKING STATUS [${tenant?.toUpperCase()}]:`,
            {
              calendarEventId,
              error: error.message,
            }
          );
          return null;
        }
      }

      return null;
    }

    const rawXStateData = (bookingData as any).xstateData;

    console.log(
      `📥 FOUND XSTATE DATA IN FIRESTORE [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
      {
        machineId: rawXStateData.machineId,
        lastTransition: rawXStateData.lastTransition,
        hasSnapshot: !!rawXStateData.snapshot,
        snapshotKeys: rawXStateData.snapshot
          ? Object.keys(rawXStateData.snapshot)
          : [],
        snapshotPreview: rawXStateData.snapshot
          ? {
              status: rawXStateData.snapshot.status,
              value: rawXStateData.snapshot.value,
              hasContext: !!rawXStateData.snapshot.context,
              contextKeys: rawXStateData.snapshot.context
                ? Object.keys(rawXStateData.snapshot.context)
                : [],
            }
          : null,
        isLegacyFormat: !rawXStateData.snapshot && !!rawXStateData.currentState,
      }
    );

    // Check if this is legacy XState v4 format and needs migration
    if (!rawXStateData.snapshot && rawXStateData.currentState) {
      console.log(
        `🔄 MIGRATING LEGACY XSTATE DATA [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
        {
          calendarEventId,
          oldCurrentState: rawXStateData.currentState,
          hasOldContext: !!rawXStateData.context,
        }
      );

      // Create new XState data from current booking status
      try {
        const newXStateData = await createXStateDataFromBookingStatus(
          calendarEventId,
          bookingData,
          tenant
        );

        const machine = getMachineForTenant(tenant);

        // Create actor with new snapshot
        const restoredActor = createActor(machine, {
          snapshot: newXStateData.snapshot,
        });

        console.log(
          `✅ LEGACY XSTATE DATA MIGRATED [${tenant?.toUpperCase()}]:`,
          {
            calendarEventId,
            machineId: newXStateData.machineId,
          }
        );

        return restoredActor;
      } catch (error) {
        console.error(
          `🚨 ERROR MIGRATING LEGACY XSTATE [${tenant?.toUpperCase()}]:`,
          {
            calendarEventId,
            error: error.message,
          }
        );
        return null;
      }
    }

    const xstateData = rawXStateData as PersistedXStateData;

    // Get the appropriate machine for the tenant
    const machine = getMachineForTenant(tenant);

    // Validate machine ID
    if (machine.id !== xstateData.machineId) {
      console.warn(
        `⚠️ MACHINE ID MISMATCH [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
        {
          expectedMachineId: machine.id,
          foundMachineId: xstateData.machineId,
          calendarEventId,
        }
      );
    }

    // Update snapshot context with current booking data services
    const updatedSnapshot = { ...xstateData.snapshot };
    if (isMediaCommons(tenant) && updatedSnapshot.context) {
      const currentServicesRequested = getMediaCommonsServices(bookingData);
      const currentServicesApproved = {
        staff: (bookingData as any).staffServiceApproved,
        equipment: (bookingData as any).equipmentServiceApproved,
        catering: (bookingData as any).cateringServiceApproved,
        cleaning: (bookingData as any).cleaningServiceApproved,
        security: (bookingData as any).securityServiceApproved,
        setup: (bookingData as any).setupServiceApproved,
      };

      console.log(
        `🔄 UPDATING XSTATE CONTEXT WITH CURRENT SERVICES [${tenant?.toUpperCase()}]:`,
        {
          calendarEventId,
          oldServicesRequested: updatedSnapshot.context.servicesRequested,
          newServicesRequested: currentServicesRequested,
          oldServicesApproved: updatedSnapshot.context.servicesApproved,
          newServicesApproved: currentServicesApproved,
        }
      );

      updatedSnapshot.context = {
        ...updatedSnapshot.context,
        servicesRequested: currentServicesRequested,
        servicesApproved: currentServicesApproved,
        tenant,
        calendarEventId,
        email: (bookingData as any).email,
      };
    }

    // Create actor with updated snapshot with error handling
    let restoredActor;
    try {
      restoredActor = createActor(machine, {
        snapshot: updatedSnapshot,
      });
    } catch (error) {
      console.error(
        `🚨 ERROR CREATING XSTATE ACTOR [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
        {
          calendarEventId,
          error: error.message,
          snapshotValue: updatedSnapshot?.value,
          hasContext: !!updatedSnapshot?.context,
        }
      );

      // If snapshot restoration fails, create new XState data
      console.log(
        `🔄 FALLING BACK TO NEW XSTATE DATA CREATION [${tenant?.toUpperCase()}]:`,
        { calendarEventId }
      );

      const newXStateData = await createXStateDataFromBookingStatus(
        calendarEventId,
        bookingData,
        tenant
      );

      restoredActor = createActor(machine, {
        snapshot: newXStateData.snapshot,
      });
    }

    console.log(
      `✅ XSTATE ACTOR RESTORED [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
      {
        calendarEventId,
        machineId: xstateData.machineId,
        restoredSuccessfully: true,
        contextUpdated: isMediaCommons(tenant),
      }
    );

    return restoredActor;
  } catch (error) {
    console.error(
      `🚨 ERROR RESTORING XSTATE [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
      {
        calendarEventId,
        error: error.message,
      }
    );
    return null;
  }
}

/**
 * Execute XState transition and save updated state to Firestore
 */
export async function executeXStateTransition(
  calendarEventId: string,
  eventType: string,
  tenant?: string,
  email?: string,
  reason?: string
): Promise<{ success: boolean; newState?: string; error?: string }> {
  try {
    console.log(
      `🎬 EXECUTING XSTATE TRANSITION [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
      {
        calendarEventId,
        eventType,
        tenant,
      }
    );

    // Restore the actor from Firestore
    const actor = await restoreXStateFromFirestore(calendarEventId, tenant);
    if (!actor) {
      return {
        success: false,
        error: "Failed to restore XState actor from Firestore",
      };
    }

    // Start the actor
    actor.start();

    // Get current snapshot with error handling
    let currentSnapshot;
    try {
      currentSnapshot = actor.getSnapshot();
      console.log(
        `📸 CURRENT SNAPSHOT BEFORE TRANSITION [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
        {
          calendarEventId,
          currentState: currentSnapshot.value,
          hasContext: !!currentSnapshot.context,
          contextKeys: currentSnapshot.context
            ? Object.keys(currentSnapshot.context)
            : [],
          contextPreview: currentSnapshot.context
            ? {
                tenant: currentSnapshot.context.tenant,
                calendarEventId: currentSnapshot.context.calendarEventId,
                selectedRooms: Array.isArray(
                  currentSnapshot.context.selectedRooms
                )
                  ? `Array(${currentSnapshot.context.selectedRooms.length})`
                  : currentSnapshot.context.selectedRooms || "undefined",
                servicesRequested: currentSnapshot.context.servicesRequested,
              }
            : null,
        }
      );
    } catch (error) {
      console.error(
        `🚨 ERROR GETTING CURRENT SNAPSHOT [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
        {
          calendarEventId,
          error: error.message,
        }
      );
      actor.stop();
      return {
        success: false,
        error: `Failed to get current snapshot: ${error.message}`,
      };
    }

    // Check if the transition is valid
    const canTransition = currentSnapshot.can({ type: eventType as any });

    if (!canTransition) {
      console.log(
        `🚫 INVALID XSTATE TRANSITION [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
        {
          currentState: currentSnapshot.value,
          attemptedEvent: eventType,
          availableEvents: [
            "approve",
            "decline",
            "cancel",
            "edit",
            "checkIn",
            "checkOut",
            "noShow",
            "close",
            "autoCloseScript",
          ].filter((event) => currentSnapshot.can({ type: event as any })),
        }
      );

      actor.stop();
      return {
        success: false,
        error: `Invalid transition: Cannot execute '${eventType}' from state '${currentSnapshot.value}'`,
      };
    }

    // Set up transition listener to capture all state changes
    const transitionStates: string[] = [];
    let unsubscribe: (() => void) | undefined;

    try {
      const subscription = actor.subscribe((snapshot) => {
        const state =
          typeof snapshot.value === "string"
            ? snapshot.value
            : JSON.stringify(snapshot.value);

        // Only track meaningful state changes (not initial state)
        if (transitionStates.length > 0 || state !== currentSnapshot.value) {
          transitionStates.push(state);
          console.log(
            `📝 XSTATE TRANSITION CAPTURED [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
            {
              calendarEventId,
              state,
              transitionIndex: transitionStates.length,
            }
          );
        }
      });

      // Handle different return types from subscribe
      if (typeof subscription === "function") {
        unsubscribe = subscription;
      } else if (
        subscription &&
        typeof subscription.unsubscribe === "function"
      ) {
        unsubscribe = () => subscription.unsubscribe();
      }

      // Execute the transition with reason if provided
      const event: any = { type: eventType as any };
      if (reason) {
        event.reason = reason;
      }
      actor.send(event);
    } catch (subscribeError) {
      console.error(
        `🚨 XSTATE SUBSCRIPTION ERROR [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
        {
          calendarEventId,
          error: subscribeError.message,
        }
      );
    } finally {
      // Unsubscribe if possible
      if (unsubscribe && typeof unsubscribe === "function") {
        try {
          unsubscribe();
        } catch (unsubError) {
          console.error(
            `🚨 XSTATE UNSUBSCRIBE ERROR [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
            {
              calendarEventId,
              error: unsubError.message,
            }
          );
        }
      }
    }
    const newSnapshot = actor.getSnapshot();

    console.log(
      `🎯 XSTATE TRANSITION EXECUTED [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
      {
        previousState: currentSnapshot.value,
        newState: newSnapshot.value,
        eventType,
        transitionPath: `${currentSnapshot.value} → ${newSnapshot.value}`,
        contextAfterTransition: {
          servicesRequested: newSnapshot.context?.servicesRequested,
          servicesApproved: newSnapshot.context?.servicesApproved,
        },
        // Additional debug info for service decline events
        ...(eventType?.includes("decline") && {
          serviceDeclineDebug: {
            isDeclineEvent: true,
            declinedService: eventType.replace("decline", "").toLowerCase(),
            allServicesApproved: newSnapshot.context?.servicesApproved,
            hasDeclinedServices: newSnapshot.context?.servicesApproved
              ? Object.values(newSnapshot.context.servicesApproved).some(
                  (val) => val === false
                )
              : false,
          },
        }),
      }
    );

    // Get updated persisted snapshot
    const updatedPersistedSnapshot = actor.getPersistedSnapshot();

    // Clean snapshot by removing undefined values for Firestore compatibility
    const cleanUpdatedSnapshot = cleanObjectForFirestore(
      updatedPersistedSnapshot
    );

    // Create updated XState data
    const updatedXStateData: PersistedXStateData = {
      snapshot: cleanUpdatedSnapshot,
      machineId: getMachineForTenant(tenant).id,
      lastTransition: new Date().toISOString(),
    };

    // Prepare updates for Firestore
    const firestoreUpdates: any = { xstateData: updatedXStateData };

    // Special handling for noShow event - execute side effects immediately
    // This is needed because noShow triggers a chain of transitions (No Show -> Canceled -> Service Closeout)
    if (eventType === "noShow") {
      console.log(
        `🚫 NO SHOW EVENT DETECTED - EXECUTING NO SHOW SIDE EFFECTS [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
        {
          calendarEventId,
          eventType,
          previousState: currentSnapshot.value,
          finalState: newSnapshot.value,
        }
      );

      // Execute No Show side effects (emails, pre-ban logs, etc.)
      // Use server-side functions since this runs in XState server context
      try {
        // Import required modules first
        const { serverGetDataByCalendarEventId } = await import(
          "@/lib/firebase/server/adminDb"
        );
        const { TableNames } = await import("@/components/src/policy");

        // Get booking document first to extract netId
        const doc = await serverGetDataByCalendarEventId<any>(
          TableNames.BOOKING,
          calendarEventId,
          tenant
        );

        if (!doc) {
          throw new Error("Booking not found");
        }

        // Get netId directly from booking document (not from XState context)
        const netId = doc.netId || "unknown";

        console.log(
          `🔄 EXECUTING NO SHOW SIDE EFFECTS [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
          {
            calendarEventId,
            email,
            netId,
          }
        );

        // Import server-side functions (doc already retrieved above)
        const { serverSaveDataToFirestore, serverFetchAllDataFromCollection } =
          await import("@/lib/firebase/server/adminDb");
        const { serverSendBookingDetailEmail } = await import(
          "@/components/src/server/admin"
        );
        const { getApprovalCcEmail } = await import("@/components/src/policy");
        const { BookingStatusLabel } = await import("@/components/src/types");

        // Check policy violation and add to pre-ban logs
        // Exclude VIP and walk-in bookings from policy violations
        const isPolicyViolation = (doc: any): boolean => {
          if (!doc || !doc.startDate || !doc.requestedAt) return false;

          // Exclude VIP bookings
          if (doc.isVip === true || doc.origin === "vip") return false;

          // Exclude walk-in bookings
          if (doc.walkedInAt || doc.origin === "walk-in") return false;

          return true;
        };

        console.log(
          `🔍 NO SHOW POLICY VIOLATION CHECK [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
          {
            calendarEventId,
            netId,
            isVip: doc.isVip,
            origin: doc.origin,
            walkedInAt: !!doc.walkedInAt,
            hasStartDate: !!doc.startDate,
            hasRequestedAt: !!doc.requestedAt,
            isPolicyViolation: isPolicyViolation(doc),
          }
        );

        if (isPolicyViolation(doc)) {
          const log = {
            netId,
            bookingId: calendarEventId,
            noShowDate: admin.firestore.Timestamp.now(),
          };
          await serverSaveDataToFirestore(TableNames.PRE_BAN_LOGS, log, tenant);

          console.log(
            `📋 NO SHOW PRE-BAN LOG CREATED [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
            {
              calendarEventId,
              netId,
              bookingId: calendarEventId,
            }
          );
        } else {
          console.log(
            `⏭️ NO SHOW PRE-BAN LOG SKIPPED [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
            {
              calendarEventId,
              netId,
              reason: "Not a policy violation (VIP or walk-in booking)",
            }
          );
        }

        // Get violation count
        const preBanLogs = await serverFetchAllDataFromCollection<any>(
          TableNames.PRE_BAN_LOGS,
          [{ field: "netId", operator: "==", value: netId }],
          tenant
        );
        const violationCount = preBanLogs.length;

        const guestEmail = doc.email;
        const headerMessage = `You have been marked as a 'No Show' and your reservation has been canceled due to not checking in within the first 30 minutes of your reservation.<br /><br />
We want to remind you that the Media Commons has a revocation policy regarding Late Cancellations and No Shows (<a href="https://sites.google.com/nyu.edu/370jmediacommons/about/our-policy" target="_blank">IV. Cancellation / V. 'No Show'</a>). Currently, you have <b>${violationCount}</b> violation(s).<br /><br />
We understand that unexpected situations come up, and we encourage you to cancel reservations at least 24 hours in advance whenever possible to help maintain a fair system for everyone. You can easily cancel through the <a href="https://sites.google.com/nyu.edu/370jmediacommons/reservations/booking-tool" target="_blank">booking tool on our website</a> or by emailing us at mediacommons.reservations@nyu.edu.<br /><br />`;

        // Send emails using server-side function
        await serverSendBookingDetailEmail({
          calendarEventId,
          targetEmail: guestEmail,
          headerMessage,
          status: BookingStatusLabel.NO_SHOW,
          tenant,
        });

        // Send CC to admin
        await serverSendBookingDetailEmail({
          calendarEventId,
          targetEmail: getApprovalCcEmail(process.env.NEXT_PUBLIC_BRANCH_NAME),
          headerMessage,
          status: BookingStatusLabel.NO_SHOW,
          tenant,
        });

        // Update calendar event status
        try {
          const calendarUpdateResponse = await fetch(
            `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/api/calendarEvents`,
            {
              method: "PUT",
              headers: {
                "Content-Type": "application/json",
                "x-tenant": tenant || "mc",
              },
              body: JSON.stringify({
                calendarEventId,
                newValues: {
                  statusPrefix: BookingStatusLabel.NO_SHOW,
                },
              }),
            }
          );

          if (calendarUpdateResponse.ok) {
            console.log(
              `📅 NO SHOW CALENDAR UPDATED [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
              {
                calendarEventId,
                statusPrefix: BookingStatusLabel.NO_SHOW,
              }
            );
          } else {
            console.error(
              `🚨 NO SHOW CALENDAR UPDATE FAILED [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
              {
                calendarEventId,
                status: calendarUpdateResponse.status,
                statusText: calendarUpdateResponse.statusText,
              }
            );
          }
        } catch (calendarError) {
          console.error(
            `🚨 NO SHOW CALENDAR UPDATE ERROR [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
            {
              calendarEventId,
              error: calendarError.message,
            }
          );
        }

        console.log(
          `✅ NO SHOW SIDE EFFECTS COMPLETED [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
          {
            calendarEventId,
            guestEmail,
            violationCount,
          }
        );
      } catch (error) {
        console.error(
          `🚨 NO SHOW SIDE EFFECTS FAILED [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
          {
            calendarEventId,
            email,
            tenant,
            error: error.message,
          }
        );
      }

      // Set noShow timestamp for Firestore
      firestoreUpdates.noShowedAt = admin.firestore.Timestamp.now();
      if (email) {
        firestoreUpdates.noShowedBy = email;
      }

      // Note: History logging is now handled by traditional functions only
      // XState only manages state transitions, not history logging
    }

    // Handle state transitions with unified history logging
    // Skip Service Closeout calendar updates if this was triggered by noShow event
    // because No Show processing already handled calendar updates
    await handleStateTransitions(
      currentSnapshot,
      newSnapshot,
      calendarEventId,
      email,
      tenant,
      firestoreUpdates,
      actor, // Pass actor instance
      eventType === "noShow", // Pass noShow flag to skip calendar updates for Service Closeout
      false, // isXStateCreation - false for normal transitions
      reason // Pass reason for decline actions
    );

    // For No Show events, do not send canceled email as NO SHOW email was already sent
    // Note: NO SHOW email contains the appropriate message for the user
    // Sending a CANCELED email would be redundant and confusing
    if (eventType === "noShow") {
      console.log(
        `🚫 CANCELED EMAIL SKIPPED FOR NO SHOW [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
        {
          calendarEventId,
          note: "NO SHOW email already sent with appropriate message",
        }
      );
    }

    // If this is Media Commons and servicesApproved context changed, update individual service fields
    if (isMediaCommons(tenant) && newSnapshot.context?.servicesApproved) {
      const servicesApproved = newSnapshot.context.servicesApproved;

      // Map XState context to individual Firestore fields
      if (typeof servicesApproved.staff === "boolean") {
        firestoreUpdates.staffServiceApproved = servicesApproved.staff;
      }
      if (typeof servicesApproved.equipment === "boolean") {
        firestoreUpdates.equipmentServiceApproved = servicesApproved.equipment;
      }
      if (typeof servicesApproved.catering === "boolean") {
        firestoreUpdates.cateringServiceApproved = servicesApproved.catering;
      }
      if (typeof servicesApproved.cleaning === "boolean") {
        firestoreUpdates.cleaningServiceApproved = servicesApproved.cleaning;
      }
      if (typeof servicesApproved.security === "boolean") {
        firestoreUpdates.securityServiceApproved = servicesApproved.security;
      }
      if (typeof servicesApproved.setup === "boolean") {
        firestoreUpdates.setupServiceApproved = servicesApproved.setup;
      }

      console.log(
        `🔄 UPDATING INDIVIDUAL SERVICE FIELDS [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
        {
          calendarEventId,
          serviceUpdates: {
            staffServiceApproved: firestoreUpdates.staffServiceApproved,
            equipmentServiceApproved: firestoreUpdates.equipmentServiceApproved,
            cateringServiceApproved: firestoreUpdates.cateringServiceApproved,
            cleaningServiceApproved: firestoreUpdates.cleaningServiceApproved,
            securityServiceApproved: firestoreUpdates.securityServiceApproved,
            setupServiceApproved: firestoreUpdates.setupServiceApproved,
          },
        }
      );
    }

    // Save updated state to Firestore
    console.log(
      `🔍 FIRESTORE UPDATE DEBUG [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
      {
        calendarEventId,
        firestoreUpdatesKeys: Object.keys(firestoreUpdates),
        hasXStateData: !!firestoreUpdates.xstateData,
        xstateDataPreview: firestoreUpdates.xstateData
          ? {
              machineId: firestoreUpdates.xstateData.machineId,
              hasSnapshot: !!firestoreUpdates.xstateData.snapshot,
              lastTransition: firestoreUpdates.xstateData.lastTransition,
            }
          : null,
      }
    );

    await serverUpdateDataByCalendarEventId(
      TableNames.BOOKING,
      calendarEventId,
      firestoreUpdates,
      tenant
    );

    console.log(
      `💾 XSTATE STATE UPDATED IN FIRESTORE [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
      {
        calendarEventId,
        newState: newSnapshot.value,
        machineId: updatedXStateData.machineId,
        savedSnapshot: {
          hasContext: !!cleanUpdatedSnapshot.context,
          contextServicesApproved:
            cleanUpdatedSnapshot.context?.servicesApproved,
        },
        individualServiceFieldsUpdated:
          isMediaCommons(tenant) && newSnapshot.context?.servicesApproved
            ? Object.keys(firestoreUpdates).filter((key) =>
                key.endsWith("ServiceApproved")
              )
            : [],
      }
    );

    actor.stop();

    return {
      success: true,
      newState: newSnapshot.value as string,
    };
  } catch (error) {
    console.error(
      `🚨 XSTATE TRANSITION ERROR [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
      {
        calendarEventId,
        eventType,
        error: error.message,
      }
    );
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Get available XState transitions for a booking
 */
export async function getAvailableXStateTransitions(
  calendarEventId: string,
  tenant?: string
): Promise<string[]> {
  try {
    const bookingData = await serverGetDataByCalendarEventId(
      TableNames.BOOKING,
      calendarEventId,
      tenant
    );

    if (
      !bookingData ||
      !("xstateData" in bookingData) ||
      !bookingData.xstateData
    ) {
      // If we have booking data but no XState data, create XState from booking status
      if (bookingData && shouldUseXState(tenant)) {
        console.log(
          `🔧 CREATING XSTATE FOR TRANSITIONS [${tenant?.toUpperCase()}]:`,
          { calendarEventId }
        );

        await createXStateDataFromBookingStatus(
          calendarEventId,
          bookingData,
          tenant
        );

        // Recursively call this function to get transitions from newly created XState
        return getAvailableXStateTransitions(calendarEventId, tenant);
      }

      return [];
    }

    const actor = await restoreXStateFromFirestore(calendarEventId, tenant);
    if (!actor) {
      return [];
    }

    actor.start();
    const snapshot = actor.getSnapshot();

    const availableTransitions = [
      "approve",
      "decline",
      "cancel",
      "edit",
      "checkIn",
      "checkOut",
      "noShow",
      "close",
      "autoCloseScript",
    ].filter((transition) => snapshot.can({ type: transition as any }));

    actor.stop();

    console.log(
      `📋 AVAILABLE XSTATE TRANSITIONS [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
      {
        calendarEventId,
        currentState: snapshot.value,
        availableTransitions,
      }
    );

    return availableTransitions;
  } catch (error) {
    console.error(
      `🚨 ERROR GETTING AVAILABLE TRANSITIONS [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
      {
        calendarEventId,
        error: error.message,
      }
    );
    return [];
  }
}

/**
 * Clean object by removing undefined values for Firestore compatibility
 */
function cleanObjectForFirestore(obj: any): any {
  if (obj === null || obj === undefined) {
    return null;
  }

  if (typeof obj !== "object") {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj
      .map((item) => cleanObjectForFirestore(item))
      .filter((item) => item !== undefined);
  }

  const cleaned: any = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      cleaned[key] = cleanObjectForFirestore(value);
    }
  }

  return cleaned;
}

/**
 * Helper function to get booking status from booking data
 */
function getBookingStatusFromData(bookingData: any): string {
  if (bookingData.noShowedAt) return BookingStatusLabel.NO_SHOW;
  if (bookingData.checkedOutAt) return BookingStatusLabel.CHECKED_OUT;
  if (bookingData.checkedInAt) return BookingStatusLabel.CHECKED_IN;
  if (bookingData.canceledAt) return BookingStatusLabel.CANCELED;
  if (bookingData.declinedAt) return BookingStatusLabel.DECLINED;
  if (bookingData.finalApprovedAt) return BookingStatusLabel.APPROVED;
  if (bookingData.firstApprovedAt) return BookingStatusLabel.PRE_APPROVED;
  if (bookingData.requestedAt) return BookingStatusLabel.REQUESTED;
  return BookingStatusLabel.UNKNOWN;
}

/**
 * Helper function to send Canceled email
 */
async function sendCanceledEmail(
  calendarEventId: string,
  email: string,
  tenant: string
) {
  try {
    const { serverGetDataByCalendarEventId } = await import(
      "@/lib/firebase/server/adminDb"
    );
    const { serverSendBookingDetailEmail } = await import(
      "@/components/src/server/admin"
    );
    const { TableNames } = await import("@/components/src/policy");

    // Get booking document to get guest email
    const bookingDoc = await serverGetDataByCalendarEventId(
      TableNames.BOOKING,
      calendarEventId,
      tenant
    );

    const guestEmail = (bookingDoc as any)?.email;

    if (guestEmail) {
      const headerMessage =
        "Your reservation has been canceled. " +
        "If you have any questions, please don't hesitate to reach out.";

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
        }
      );
    } else {
      console.warn(
        `⚠️ CANCELED EMAIL SKIPPED - NO EMAIL [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
        {
          calendarEventId,
        }
      );
    }
  } catch (error) {
    console.error(
      `🚨 CANCELED EMAIL FAILED [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
      {
        calendarEventId,
        error: error.message,
      }
    );
  }
}
