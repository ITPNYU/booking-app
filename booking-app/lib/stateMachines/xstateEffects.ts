import type { SchemaContextType } from "@/components/src/client/routes/components/SchemaProvider";
import { TableNames } from "@/components/src/policy";
import { getTenantEmailConfig } from "@/components/src/server/emails";
import { BookingStatusLabel } from "@/components/src/types";
import {
  serverGetDocumentById,
} from "@/lib/firebase/server/adminDb";
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
      `[XState] failed to get booking data [${tenant?.toUpperCase() || "UNKNOWN"}]`,
      { calendarEventId, error: error.message },
    );
  }

  // Handle specific state transitions
  if (newState === "Approved" && previousState !== "Approved") {
    handleApprovedTransition(calendarEventId, email, tenant, firestoreUpdates, previousState, newState);
  } else if (newState === "Declined" && previousState !== "Declined") {
    await handleDeclinedTransition(calendarEventId, email, tenant, firestoreUpdates, previousState, newState, newSnapshot, bookingDoc, reason);
  } else if (newState === "Requested" && previousState !== "Requested") {
    // No side effects needed for Requested state
  } else if (newState === "No Show" && previousState !== "No Show") {
    handleNoShowTransition(calendarEventId, email, tenant, firestoreUpdates);
  } else if (newState === "Canceled" && previousState !== "Canceled") {
    handleCanceledTransition(calendarEventId, email, tenant, firestoreUpdates);
  } else if (newState === "Closed" && previousState !== "Closed") {
    // No side effects needed for Closed state
  } else if (newState === "Checked In" && previousState !== "Checked In") {
    await handleCheckedInTransition(calendarEventId, email, tenant, firestoreUpdates, previousState, newState, actor, currentSnapshot, newSnapshot);
  } else if (newState === "Pre-approved" && previousState !== "Pre-approved") {
    await handlePreApprovedTransition(calendarEventId, email, tenant, firestoreUpdates, previousState, newState);
  }
  // Parallel states (Services Request, Service Closeout) are handled by their
  // respective API routes (/api/services, /api/checkout-processing) called
  // directly from the XState machine actions. No additional side effects needed here.
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

  // Send decline email to guest using booking document email
  try {
    const guestEmail = bookingDoc?.email;

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
        `[XState] decline email sent [${tenant?.toUpperCase() || "UNKNOWN"}]`,
        { calendarEventId, guestEmail },
      );
    } else {
      console.warn(
        `[XState] decline email skipped — no guest email [${tenant?.toUpperCase() || "UNKNOWN"}]`,
        { calendarEventId },
      );
    }
  } catch (error) {
    console.error(
      `[XState] decline email failed [${tenant?.toUpperCase() || "UNKNOWN"}]`,
      { calendarEventId, error: error.message },
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

    if (!response.ok) {
      console.error(
        `[XState] decline calendar update failed [${tenant?.toUpperCase() || "UNKNOWN"}]`,
        { calendarEventId, status: response.status },
      );
    }
  } catch (error) {
    console.error(
      `[XState] decline calendar update error [${tenant?.toUpperCase() || "UNKNOWN"}]`,
      { calendarEventId, error: error.message },
    );
  }
}

function handleNoShowTransition(
  calendarEventId: string,
  email: string,
  tenant: string,
  firestoreUpdates: any,
) {
  firestoreUpdates.noShowedAt = admin.firestore.Timestamp.now();
  if (email) {
    firestoreUpdates.noShowedBy = email;
  }
}

function handleCanceledTransition(
  calendarEventId: string,
  email: string,
  tenant: string,
  firestoreUpdates: any,
) {
  firestoreUpdates.canceledAt = admin.firestore.Timestamp.now();
  if (email) {
    firestoreUpdates.canceledBy = email;
  }
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
  } catch (error) {
    console.error(
      `[XState] check-in pre-persist failed [${tenant?.toUpperCase() || "UNKNOWN"}]`,
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

    if (!response.ok) {
      console.error(
        `[XState] check-in calendar update failed [${tenant?.toUpperCase() || "UNKNOWN"}]`,
        { calendarEventId, status: response.status },
      );
    }
  } catch (error) {
    console.error(
      `[XState] check-in calendar update error [${tenant?.toUpperCase() || "UNKNOWN"}]`,
      { calendarEventId, error: error.message },
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
  } catch (error) {
    console.error(
      `[XState] pre-approved data save failed [${tenant?.toUpperCase() || "UNKNOWN"}]`,
      { calendarEventId, error: error instanceof Error ? error.message : String(error) },
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

    if (!response.ok) {
      console.error(
        `[XState] pre-approved calendar update failed [${tenant?.toUpperCase() || "UNKNOWN"}]`,
        { calendarEventId, status: response.status },
      );
    }
  } catch (error) {
    console.error(
      `[XState] pre-approved calendar update error [${tenant?.toUpperCase() || "UNKNOWN"}]`,
      { calendarEventId, error: error.message },
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

    const guestEmail = (bookingDoc as any)?.email || email;

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
        `[XState] canceled email sent [${tenant?.toUpperCase() || "UNKNOWN"}]`,
        { calendarEventId, guestEmail },
      );
    } else {
      console.warn(
        `[XState] canceled email skipped — no guest email [${tenant?.toUpperCase() || "UNKNOWN"}]`,
        { calendarEventId },
      );
    }
  } catch (error) {
    console.error(
      `[XState] canceled email failed [${tenant?.toUpperCase() || "UNKNOWN"}]`,
      { calendarEventId, error: error.message },
    );
  }
}
