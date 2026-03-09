import type { SchemaContextType } from "@/components/src/client/routes/components/SchemaProvider";
import { TableNames } from "@/components/src/policy";
import { getTenantEmailConfig } from "@/components/src/server/emails";
import { BookingStatusLabel } from "@/components/src/types";
import {
  serverGetDataByCalendarEventId,
  serverGetDocumentById,
} from "@/lib/firebase/server/adminDb";
import { BookingLogger } from "@/lib/logger/bookingLogger";
import * as admin from "firebase-admin";
import type { PersistedXStateData } from "./xstatePersistence";
import { cleanObjectForFirestore } from "./xstatePersistence";

type PreApprovalUpdateData = {
  firstApprovedAt: admin.firestore.Timestamp;
  firstApprovedBy?: string;
  xstateData?: PersistedXStateData;
};

/**
 * Unified state transition handler with side effects.
 * Dispatches Firestore updates, emails, and calendar updates based on state changes.
 */
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

  // Handle specific state transitions
  if (newState === "Approved" && previousState !== "Approved") {
    handleApprovedTransition(calendarEventId, email, tenant, firestoreUpdates, previousState, newState);
  } else if (newState === "Declined" && previousState !== "Declined") {
    await handleDeclinedTransition(calendarEventId, email, tenant, firestoreUpdates, previousState, newState, newSnapshot, bookingDoc, reason);
  } else if (newState === "Requested" && previousState !== "Requested") {
    handleRequestedTransition(calendarEventId, tenant, previousState, newState);
  } else if (newState === "No Show" && previousState !== "No Show") {
    handleNoShowTransition(calendarEventId, email, tenant, firestoreUpdates, previousState, newState);
  } else if (newState === "Canceled" && previousState !== "Canceled") {
    handleCanceledTransition(calendarEventId, email, tenant, firestoreUpdates, previousState, newState);
  } else if (newState === "Closed" && previousState !== "Closed") {
    handleClosedTransition(calendarEventId, tenant, previousState, newState);
  } else if (newState === "Checked In" && previousState !== "Checked In") {
    await handleCheckedInTransition(calendarEventId, email, tenant, firestoreUpdates, previousState, newState, actor, currentSnapshot, newSnapshot);
  } else if (newState === "Pre-approved" && previousState !== "Pre-approved") {
    await handlePreApprovedTransition(calendarEventId, email, tenant, firestoreUpdates, previousState, newState);
  } else {
    await handleGenericTransition(calendarEventId, email, tenant, firestoreUpdates, previousState, newState, newSnapshot, bookingDoc, skipCalendarForServiceCloseout);
  }
}

function handleApprovedTransition(
  calendarEventId: string,
  email: string,
  tenant: string,
  firestoreUpdates: any,
  previousState: string,
  newState: string,
) {
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
}

async function handleDeclinedTransition(
  calendarEventId: string,
  email: string,
  tenant: string,
  firestoreUpdates: any,
  previousState: string,
  newState: string,
  newSnapshot: any,
  bookingDoc: any,
  reason?: string,
) {
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
    },
  );

  // Send decline email to guest using booking document email
  try {
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
      },
    );

    if (guestEmail) {
      const { serverSendBookingDetailEmail } =
        await import("@/components/src/server/admin");
      const emailConfig = await getTenantEmailConfig(tenant);
      let headerMessage = emailConfig.emailMessages.declined;

      // Fetch tenant schema to get declinedGracePeriod (default: 24 hours)
      const schema = tenant
        ? await serverGetDocumentById<SchemaContextType>(
            TableNames.TENANT_SCHEMA,
            tenant,
          )
        : null;
      const gracePeriodHours = schema?.declinedGracePeriod ?? 24;

      // Check which services were declined and include them in the message
      const declinedServices = [];
      if (newSnapshot.context?.servicesApproved) {
        const { servicesApproved } = newSnapshot.context;
        const servicesRequested = newSnapshot.context.servicesRequested || {};

        Object.entries(servicesApproved).forEach(([service, approved]) => {
          if (servicesRequested[service] && approved === false) {
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

      headerMessage += ` Reason: ${declineReason}. <br /><br />You have ${gracePeriodHours} hours to edit your request if you'd like to make changes. After ${gracePeriodHours} hours, your request will be automatically canceled. <br /><br />If you have any questions or need further assistance, please don't hesitate to reach out.`;

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
        },
      );
    } else {
      console.warn(
        `⚠️ XSTATE DECLINE EMAIL SKIPPED - NO EMAIL IN CONTEXT [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
        {
          calendarEventId,
          contextKeys: newSnapshot.context
            ? Object.keys(newSnapshot.context)
            : [],
        },
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
      },
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
      },
    );

    if (response.ok) {
      console.log(
        `📅 XSTATE DECLINE CALENDAR UPDATED [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
        {
          calendarEventId,
          statusPrefix: BookingStatusLabel.DECLINED,
        },
      );
    } else {
      console.error(
        `🚨 XSTATE DECLINE CALENDAR UPDATE FAILED [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
        {
          calendarEventId,
          status: response.status,
          statusText: response.statusText,
        },
      );
    }
  } catch (error) {
    console.error(
      `🚨 XSTATE DECLINE CALENDAR UPDATE ERROR [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
      {
        calendarEventId,
        error: error.message,
      },
    );
  }
}

function handleRequestedTransition(
  calendarEventId: string,
  tenant: string,
  previousState: string,
  newState: string,
) {
  console.log(
    `🔄 XSTATE REACHED REQUESTED [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
    {
      calendarEventId,
      previousState,
      newState,
      note: "Decline field cleanup handled by calling API",
    },
  );
}

function handleNoShowTransition(
  calendarEventId: string,
  email: string,
  tenant: string,
  firestoreUpdates: any,
  previousState: string,
  newState: string,
) {
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
}

function handleCanceledTransition(
  calendarEventId: string,
  email: string,
  tenant: string,
  firestoreUpdates: any,
  previousState: string,
  newState: string,
) {
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
}

function handleClosedTransition(
  calendarEventId: string,
  tenant: string,
  previousState: string,
  newState: string,
) {
  console.log(
    `🎯 XSTATE REACHED CLOSED [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
    {
      calendarEventId,
      previousState,
      newState,
      note: "Close processing handled by XState action",
    },
  );
}

async function handleCheckedInTransition(
  calendarEventId: string,
  email: string,
  tenant: string,
  firestoreUpdates: any,
  previousState: string,
  newState: string,
  actor: any,
  currentSnapshot: any,
  newSnapshot: any,
) {
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
    },
  );

  // Persist latest XState snapshot and checked-in timestamps BEFORE calendar update
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
        checkedInAt: firestoreUpdates.checkedInAt,
        checkedInBy: firestoreUpdates.checkedInBy,
      },
      tenant,
    );

    console.log(
      `💾 XSTATE CHECK-IN: STATE PERSISTED BEFORE CAL UPDATE [${
        tenant?.toUpperCase() || "UNKNOWN"
      }]:`,
      {
        calendarEventId,
        savedState: "Checked In",
      },
    );
  } catch (error) {
    console.error(
      `🚨 XSTATE CHECK-IN: FAILED TO PERSIST BEFORE CAL UPDATE [${
        tenant?.toUpperCase() || "UNKNOWN"
      }]:`,
      { calendarEventId, error: error?.message },
    );
  }

  // Update calendar event with CHECKED_IN status
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
      },
    );

    if (response.ok) {
      console.log(
        `📅 XSTATE CHECK-IN CALENDAR UPDATED [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
        {
          calendarEventId,
          statusPrefix: BookingStatusLabel.CHECKED_IN,
          note: "Status will be read from XState data",
        },
      );
    }
  } catch (error) {
    console.error(
      `🚨 XSTATE CHECK-IN CALENDAR UPDATE ERROR [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
      {
        calendarEventId,
        error: error.message,
      },
    );
  }
}

async function handlePreApprovedTransition(
  calendarEventId: string,
  email: string,
  tenant: string,
  firestoreUpdates: any,
  previousState: string,
  newState: string,
) {
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
  }

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
}

async function handleGenericTransition(
  calendarEventId: string,
  email: string,
  tenant: string,
  firestoreUpdates: any,
  previousState: string,
  newState: string,
  newSnapshot: any,
  bookingDoc: any,
  skipCalendarForServiceCloseout: boolean,
) {
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
                "x-tenant": tenant || "mc",
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
