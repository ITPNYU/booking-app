import { DEFAULT_TENANT } from "@/components/src/constants/tenants";
import { TableNames } from "@/components/src/policy";
import {
  serverBookingContents,
  serverSendBookingDetailEmail,
  serverSendConfirmationEmail,
  serverUpdateDataByCalendarEventId,
} from "@/components/src/server/admin";
import { updateCalendarEvent } from "@/components/src/server/calendars";
import { getTenantEmailConfig } from "@/components/src/server/emails";
import { getApprovalCcEmail } from "@/components/src/tenantPolicyServer";
import { BookingStatusLabel } from "@/components/src/types";
import {
  logServerBookingChange,
  serverFetchAllDataFromCollection,
  serverGetDataByCalendarEventId,
  serverSaveDataToFirestore,
} from "@/lib/firebase/server/adminDb";
import { requireSession } from "@/lib/api/requireSession";
import { shouldBypassAuth } from "@/lib/utils/testEnvironment";
import { Timestamp } from "firebase-admin/firestore";
import { NextRequest, NextResponse } from "next/server";

/**
 * Traditional no-show fallback used when the XState transition API fails.
 * Mirrors executeTraditionalNoShow: Firestore stamp, pre-ban log, history,
 * guest/CC emails, confirmation email, calendar [NO SHOW] prefix.
 */
export async function POST(req: NextRequest) {
  let requestBody: {
    calendarEventId?: string;
    email?: string;
  } = {};

  try {
    requestBody = await req.json();
    const { calendarEventId, email } = requestBody;
    const tenant = req.headers.get("x-tenant") || DEFAULT_TENANT;

    if (!calendarEventId) {
      return NextResponse.json(
        { error: "Missing required field: calendarEventId" },
        { status: 400 },
      );
    }

    const session = await requireSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only the authenticated session may determine the audit actor. E2E tests
    // have no real session, so preserve their explicit mocked identity.
    const actorEmail =
      shouldBypassAuth() && email?.trim() ? email.trim() : session.email;

    console.log(
      `🔄 NOSHOW PROCESSING API CALLED [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
      { calendarEventId, actorEmail, tenant },
    );

    const bookingDoc = (await serverGetDataByCalendarEventId(
      TableNames.BOOKING,
      calendarEventId,
      tenant,
    )) as {
      id?: string;
      requestNumber?: number;
      email?: string;
      roomId?: string;
      startDate?: unknown;
      requestedAt?: unknown;
      netId?: string;
    } | null;

    if (!bookingDoc) {
      throw new Error("Booking not found");
    }

    // The policy violation belongs to the person who made the booking, not
    // the operator. Never accept that identity from the request body.
    const bookingNetId = bookingDoc.netId || bookingDoc.email?.split("@")[0];

    await serverUpdateDataByCalendarEventId(
      TableNames.BOOKING,
      calendarEventId,
      {
        noShowedAt: Timestamp.now(),
        noShowedBy: actorEmail,
      },
      tenant,
    );

    // Pre-ban policy-violation log (same gate as traditional helper)
    if (bookingDoc.startDate && bookingDoc.requestedAt && bookingNetId) {
      await serverSaveDataToFirestore(
        TableNames.PRE_BAN_LOGS,
        {
          netId: bookingNetId,
          bookingId: calendarEventId,
          noShowDate: Timestamp.now(),
        },
        tenant,
      );
    }

    if (bookingDoc.id && bookingDoc.requestNumber != null) {
      await logServerBookingChange({
        bookingId: bookingDoc.id,
        calendarEventId,
        status: BookingStatusLabel.NO_SHOW,
        changedBy: actorEmail,
        requestNumber: bookingDoc.requestNumber,
        tenant,
      });
    }

    const preBanLogs = await serverFetchAllDataFromCollection(
      TableNames.PRE_BAN_LOGS,
      undefined,
      tenant,
    );
    const violationCount = bookingNetId
      ? preBanLogs.filter(
          (log: any) => log.netId === bookingNetId && log?.excused !== true,
        ).length
      : 0;

    const emailConfig = await getTenantEmailConfig(tenant);
    const headerMessage = emailConfig.emailNotifications.noShow.replace(
      "${violationCount}",
      violationCount.toString(),
    );

    const guestEmail = bookingDoc.email;
    if (guestEmail) {
      await serverSendBookingDetailEmail({
        calendarEventId,
        targetEmail: guestEmail,
        headerMessage,
        status: BookingStatusLabel.NO_SHOW,
        tenant,
      });
    }

    const noShowCcEmail = await getApprovalCcEmail(
      process.env.NEXT_PUBLIC_BRANCH_NAME,
      tenant,
    );
    if (noShowCcEmail) {
      await serverSendBookingDetailEmail({
        calendarEventId,
        targetEmail: noShowCcEmail,
        headerMessage,
        status: BookingStatusLabel.NO_SHOW,
        tenant,
      });
    }

    await serverSendConfirmationEmail({
      calendarEventId,
      status: BookingStatusLabel.NO_SHOW,
      headerMessage: "This is a no show email.",
      guestEmail,
      tenant,
      roomId: bookingDoc.roomId,
    });

    try {
      const bookingContents = await serverBookingContents(
        calendarEventId,
        tenant,
      );
      await updateCalendarEvent(
        calendarEventId,
        { statusPrefix: BookingStatusLabel.NO_SHOW },
        bookingContents,
        tenant,
      );
    } catch (calendarError) {
      console.error(
        `🚨 NOSHOW CALENDAR UPDATE FAILED [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
        calendarError,
      );
    }

    console.log(
      `✅ NOSHOW PROCESSING API SUCCESS [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
      { calendarEventId, actorEmail, bookingNetId },
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("🚨 NOSHOW PROCESSING API ERROR:", {
      error: error?.message,
      stack: error?.stack,
    });

    return NextResponse.json(
      { success: false, error: error?.message || "No-show processing failed" },
      { status: 500 },
    );
  }
}
