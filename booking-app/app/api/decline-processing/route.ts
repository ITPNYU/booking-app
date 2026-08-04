import { TableNames } from "@/components/src/policy";
import {
  serverBookingContents,
  serverSendBookingDetailEmail,
  serverUpdateDataByCalendarEventId,
} from "@/components/src/server/admin";
import { updateCalendarEvent } from "@/components/src/server/calendars";
import { getTenantEmailConfig } from "@/components/src/server/emails";
import { BookingStatusLabel } from "@/components/src/types";
import type { SchemaContextType } from "@/components/src/client/routes/components/SchemaProvider";
import {
  logServerBookingChange,
  serverGetDataByCalendarEventId,
  serverGetDocumentById,
} from "@/lib/firebase/server/adminDb";
import { Timestamp } from "firebase-admin/firestore";
import { NextRequest, NextResponse } from "next/server";

/**
 * Traditional decline fallback used when the XState transition API fails
 * (or for non-XState tenants). Mirrors the old server/db.ts decline side effects:
 * Firestore stamp, history log, guest email, calendar [DECLINED] prefix.
 */
export async function POST(req: NextRequest) {
  let requestBody: {
    calendarEventId?: string;
    email?: string;
    reason?: string;
    tenant?: string;
  } = {};

  try {
    requestBody = await req.json();
    const { calendarEventId, email, reason, tenant } = requestBody;

    if (!calendarEventId || !email) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    console.log(
      `🔄 DECLINE PROCESSING API CALLED [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
      { calendarEventId, email, reason, tenant },
    );

    const bookingDoc = (await serverGetDataByCalendarEventId(
      TableNames.BOOKING,
      calendarEventId,
      tenant,
    )) as { id?: string; requestNumber?: number; email?: string } | null;

    if (!bookingDoc) {
      throw new Error("Booking not found");
    }

    await serverUpdateDataByCalendarEventId(
      TableNames.BOOKING,
      calendarEventId,
      {
        declinedAt: Timestamp.now(),
        declinedBy: email,
        declineReason: reason || null,
      },
      tenant,
    );

    if (bookingDoc.id && bookingDoc.requestNumber != null) {
      await logServerBookingChange({
        bookingId: bookingDoc.id,
        calendarEventId,
        status: BookingStatusLabel.DECLINED,
        changedBy: email,
        requestNumber: bookingDoc.requestNumber,
        note: reason,
        tenant,
      });
    }

    const guestEmail = bookingDoc.email;
    if (guestEmail) {
      const emailConfig = await getTenantEmailConfig(tenant);
      let headerMessage = emailConfig.emailNotifications.declined;

      const schema = tenant
        ? await serverGetDocumentById<SchemaContextType>(
            TableNames.TENANT_SCHEMA,
            tenant,
          )
        : null;
      const gracePeriodHours = schema?.declinedGracePeriod ?? 24;

      if (reason) {
        headerMessage += ` Reason: ${reason}. <br /><br />You have ${gracePeriodHours} hours to edit your request if you'd like to make changes. After ${gracePeriodHours} hours, your request will be automatically canceled. <br /><br />If you have any questions or need further assistance, please don't hesitate to reach out.`;
      } else {
        headerMessage += `<br />You have ${gracePeriodHours} hours to edit your request if you'd like to make changes. After ${gracePeriodHours} hours, your request will be automatically canceled. <br /><br />If you have any questions or need further assistance, please don't hesitate to reach out.`;
      }

      await serverSendBookingDetailEmail({
        calendarEventId,
        targetEmail: guestEmail,
        headerMessage,
        status: BookingStatusLabel.DECLINED,
        tenant,
      });
    }

    try {
      const bookingContents = await serverBookingContents(
        calendarEventId,
        tenant,
      );
      await updateCalendarEvent(
        calendarEventId,
        { statusPrefix: BookingStatusLabel.DECLINED },
        bookingContents,
        tenant,
      );
    } catch (calendarError) {
      console.error(
        `🚨 DECLINE CALENDAR UPDATE FAILED [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
        calendarError,
      );
    }

    console.log(
      `✅ DECLINE PROCESSING API SUCCESS [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
      { calendarEventId, email },
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("🚨 DECLINE PROCESSING API ERROR:", {
      error: error?.message,
      stack: error?.stack,
    });

    return NextResponse.json(
      { success: false, error: error?.message || "Decline processing failed" },
      { status: 500 },
    );
  }
}
