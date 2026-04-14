import type { SchemaContextType } from "@/components/src/client/routes/components/SchemaProvider";
import { DEFAULT_TENANT } from "@/components/src/constants/tenants";
import { TableNames } from "@/components/src/policy";
import { getTenantEmailConfig } from "@/components/src/server/emails";
import { BookingStatusLabel } from "@/components/src/types";
import { serverGetDocumentById } from "@/lib/firebase/server/adminDb";
import * as admin from "firebase-admin";
import type { HandlerContext, StateHandler } from "./types";

/**
 * Handler for the `Declined` state entry.
 *
 * Most substantial side-effect handler in the dispatcher:
 * 1. Stamps declinedAt / declinedBy onto firestoreUpdates
 * 2. Composes and sends a decline email to the guest, including the
 *    tenant-specific grace period and — for parallel state declines —
 *    the list of specific services that were declined
 * 3. PUTs /api/calendarEvents to prefix the Google Calendar event title
 *    with `[DECLINED]`
 */
export const handleDeclinedEntry: StateHandler = async (
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
    newSnapshot,
    reason,
  } = ctx;

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
      const declinedServices: string[] = [];
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
        error: error instanceof Error ? error.message : String(error),
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
          "x-tenant": tenant || DEFAULT_TENANT,
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
        error: error instanceof Error ? error.message : String(error),
      },
    );
  }
};
