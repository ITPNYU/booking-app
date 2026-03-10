import type { SchemaContextType } from "@/components/src/client/routes/components/SchemaProvider";
import { TableNames } from "@/components/src/policy";
import {
  serverSendBookingDetailEmail,
  serverUpdateDataByCalendarEventId,
} from "@/components/src/server/admin";
import { getTenantEmailConfig } from "@/components/src/server/emails";
import { BookingStatusLabel } from "@/components/src/types";
import {
  logServerBookingChange,
  serverGetDataByCalendarEventId,
  serverGetDocumentById,
} from "@/lib/firebase/server/adminDb";
import * as admin from "firebase-admin";
import { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const {
      calendarEventId,
      email,
      tenant,
      reason,
      declinedServices,
      declineReason,
    } = await req.json();

    console.log(
      `[decline-processing] started [${tenant?.toUpperCase() || "UNKNOWN"}]`,
      { calendarEventId, email },
    );

    // Set decline timestamps
    const updateData: Record<string, any> = {
      declinedAt: admin.firestore.Timestamp.now(),
    };
    if (email) {
      updateData.declinedBy = email;
    }

    await serverUpdateDataByCalendarEventId(
      TableNames.BOOKING,
      calendarEventId,
      updateData,
      tenant,
    );

    // Get booking data for email
    const bookingDoc = await serverGetDataByCalendarEventId<any>(
      TableNames.BOOKING,
      calendarEventId,
      tenant,
    );

    // Send decline email to guest
    const guestEmail = bookingDoc?.email;
    if (guestEmail) {
      try {
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

        // Use decline reason from context, parameter, or default
        let finalDeclineReason =
          declineReason ||
          reason ||
          "Service requirements could not be fulfilled";

        // If specific services were declined, include them in the reason
        if (declinedServices && declinedServices.length > 0) {
          const servicesList = declinedServices.join(", ");
          finalDeclineReason = `The following service(s) could not be fulfilled: ${servicesList}`;
        }

        headerMessage += ` Reason: ${finalDeclineReason}. <br /><br />You have ${gracePeriodHours} hours to edit your request if you'd like to make changes. After ${gracePeriodHours} hours, your request will be automatically canceled. <br /><br />If you have any questions or need further assistance, please don't hesitate to reach out.`;

        await serverSendBookingDetailEmail({
          calendarEventId,
          targetEmail: guestEmail,
          headerMessage,
          status: BookingStatusLabel.DECLINED,
          tenant,
        });

        console.log(
          `[decline-processing] email sent [${tenant?.toUpperCase() || "UNKNOWN"}]`,
          { calendarEventId, guestEmail },
        );
      } catch (error) {
        console.error(
          `[decline-processing] email failed [${tenant?.toUpperCase() || "UNKNOWN"}]`,
          {
            calendarEventId,
            error: error instanceof Error ? error.message : String(error),
          },
        );
      }
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
          `[decline-processing] calendar update failed [${tenant?.toUpperCase() || "UNKNOWN"}]`,
          { calendarEventId, status: response.status },
        );
      }
    } catch (error) {
      console.error(
        `[decline-processing] calendar update error [${tenant?.toUpperCase() || "UNKNOWN"}]`,
        {
          calendarEventId,
          error: error instanceof Error ? error.message : String(error),
        },
      );
    }

    // Log booking history
    if (bookingDoc) {
      try {
        await logServerBookingChange({
          bookingId: bookingDoc.id,
          calendarEventId,
          status: BookingStatusLabel.DECLINED,
          changedBy: email || "system",
          requestNumber: bookingDoc.requestNumber || 0,
          note: reason || "",
          tenant,
        });
      } catch (error) {
        console.error(
          `[decline-processing] history log failed [${tenant?.toUpperCase() || "UNKNOWN"}]`,
          {
            calendarEventId,
            error: error instanceof Error ? error.message : String(error),
          },
        );
      }
    }

    console.log(
      `[decline-processing] completed [${tenant?.toUpperCase() || "UNKNOWN"}]`,
      { calendarEventId },
    );

    return Response.json({ success: true });
  } catch (error) {
    console.error("[decline-processing] error:", {
      error: error instanceof Error ? error.message : String(error),
    });

    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
