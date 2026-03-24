import { TableNames } from "@/components/src/policy";
import {
  serverBookingContents,
  serverSendBookingDetailEmail,
  serverUpdateDataByCalendarEventId,
} from "@/components/src/server/admin";
import { updateCalendarEvent } from "@/components/src/server/calendars";
import { getTenantEmailConfig } from "@/components/src/server/emails";
import { BookingStatusLabel } from "@/components/src/types";
import {
  logServerBookingChange,
  serverGetDataByCalendarEventId,
} from "@/lib/firebase/server/adminDb";
import { BookingLogger } from "@/lib/logger/bookingLogger";
import { Timestamp } from "firebase-admin/firestore";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  let requestBody: any = {};

  try {
    requestBody = await req.json();
    const { calendarEventId, email, tenant } = requestBody;

    if (!calendarEventId || !email || !tenant) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    BookingLogger.apiRequest("POST", "/api/checkin-processing", {
      calendarEventId,
      email,
      tenant,
    });

    // Get booking data
    const bookingDoc = (await serverGetDataByCalendarEventId(
      TableNames.BOOKING,
      calendarEventId,
      tenant,
    )) as any;

    if (!bookingDoc) {
      throw new Error("Booking not found");
    }

    // Update Firestore with checkin timestamp and checkedInBy
    await serverUpdateDataByCalendarEventId(
      TableNames.BOOKING,
      calendarEventId,
      {
        checkedInAt: Timestamp.now(),
        checkedInBy: email,
      },
      tenant,
    );

    BookingLogger.dbOperation("UPDATE", "bookings", {
      calendarEventId,
      tenant,
      operation: "set checkin timestamp",
    });

    // Send checkin email to guest
    try {
      const guestEmail = bookingDoc.email;
      if (guestEmail) {
        const emailConfig = await getTenantEmailConfig(tenant);

        await serverSendBookingDetailEmail({
          calendarEventId,
          targetEmail: guestEmail,
          headerMessage: emailConfig.emailMessages.checkinConfirmation,
          status: BookingStatusLabel.CHECKED_IN,
          tenant,
        });

        BookingLogger.emailSent(
          "Checkin notification",
          {
            calendarEventId,
            tenant,
          },
          guestEmail,
        );
      } else {
        BookingLogger.warning(
          "No guest email found for checkin notification",
          {
            calendarEventId,
            tenant,
          },
        );
      }
    } catch (emailError) {
      BookingLogger.emailError(
        "Checkin notification",
        {
          calendarEventId,
          tenant,
        },
        emailError,
      );
    }

    // Update calendar event with CHECKED_IN status
    try {
      const bookingContents = await serverBookingContents(
        calendarEventId,
        tenant,
      );

      await updateCalendarEvent(
        calendarEventId,
        {
          statusPrefix: BookingStatusLabel.CHECKED_IN,
        },
        bookingContents,
        tenant,
      );

      BookingLogger.calendarUpdate(
        "Checkin status update",
        {
          calendarEventId,
          tenant,
        },
        {
          statusPrefix: BookingStatusLabel.CHECKED_IN,
        },
      );
    } catch (calendarError) {
      BookingLogger.calendarError(
        "Checkin calendar update",
        {
          calendarEventId,
          tenant,
        },
        calendarError,
      );
    }

    // Log booking change history
    if (bookingDoc.id && bookingDoc.requestNumber) {
      await logServerBookingChange({
        bookingId: bookingDoc.id,
        calendarEventId,
        status: BookingStatusLabel.CHECKED_IN,
        changedBy: email,
        requestNumber: bookingDoc.requestNumber,
        tenant,
      });

      BookingLogger.statusChange("Approved", "Checked In", {
        calendarEventId,
        tenant,
        bookingId: bookingDoc.id,
        requestNumber: bookingDoc.requestNumber,
      });
    }

    BookingLogger.apiSuccess("POST", "/api/checkin-processing", {
      calendarEventId,
      tenant,
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    BookingLogger.apiError(
      "POST",
      "/api/checkin-processing",
      {
        calendarEventId: requestBody?.calendarEventId,
        tenant: requestBody?.tenant,
      },
      error,
    );

    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
