import { TableNames } from "@/components/src/policy";
import {
  serverBookingContents,
  serverSendBookingDetailEmail,
  serverUpdateDataByCalendarEventId,
} from "@/components/src/server/admin";
import { updateCalendarEvent } from "@/components/src/server/calendars";
import { BookingStatusLabel } from "@/components/src/types";
import { clientGetDataByCalendarEventId } from "@/lib/firebase/firebase";
import { logServerBookingChange } from "@/lib/firebase/server/adminDb";
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

    BookingLogger.apiRequest("POST", "/api/checkout-processing", {
      calendarEventId,
      email,
      tenant,
    });

    // Get booking data
    const bookingDoc = (await clientGetDataByCalendarEventId(
      TableNames.BOOKING,
      calendarEventId,
      tenant,
    )) as any;

    if (!bookingDoc) {
      throw new Error("Booking not found");
    }

    // Update Firestore with checkout timestamp
    const checkedOutAt = Timestamp.now();
    await serverUpdateDataByCalendarEventId(
      TableNames.BOOKING,
      calendarEventId,
      {
        checkedOutAt,
        checkedOutBy: email,
      },
      tenant,
    );

    BookingLogger.dbOperation("UPDATE", "bookings", {
      calendarEventId,
      tenant,
      operation: "set checkout timestamp",
    });

    // Send checkout email to guest
    try {
      const guestEmail = bookingDoc.email;
      if (guestEmail) {
        const headerMessage =
          "Your reservation request for Media Commons has been checked out. Thank you for choosing Media Commons.";

        await serverSendBookingDetailEmail({
          calendarEventId,
          targetEmail: guestEmail,
          headerMessage,
          status: BookingStatusLabel.CHECKED_OUT,
          tenant,
        });

        BookingLogger.emailSent(
          "Checkout notification",
          {
            calendarEventId,
            tenant,
          },
          guestEmail,
        );
      } else {
        BookingLogger.warning(
          "No guest email found for checkout notification",
          {
            calendarEventId,
            tenant,
          },
        );
      }
    } catch (emailError) {
      BookingLogger.emailError(
        "Checkout notification",
        {
          calendarEventId,
          tenant,
        },
        emailError,
      );
    }

    // Update calendar event with CHECKED_OUT status
    try {
      const bookingContents = await serverBookingContents(
        calendarEventId,
        tenant,
      );

      await updateCalendarEvent(
        calendarEventId,
        {
          statusPrefix: BookingStatusLabel.CHECKED_OUT,
          end: {
            dateTime: new Date().toISOString(),
          },
        },
        bookingContents,
        tenant,
      );

      BookingLogger.calendarUpdate(
        "Checkout status update",
        {
          calendarEventId,
          tenant,
        },
        {
          statusPrefix: BookingStatusLabel.CHECKED_OUT,
          endTime: new Date().toISOString(),
        },
      );
    } catch (calendarError) {
      BookingLogger.calendarError(
        "Checkout calendar update",
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
        status: BookingStatusLabel.CHECKED_OUT,
        changedBy: email,
        requestNumber: bookingDoc.requestNumber,
        tenant,
      });

      BookingLogger.statusChange("Checked In", "Checked Out", {
        calendarEventId,
        tenant,
        bookingId: bookingDoc.id,
        requestNumber: bookingDoc.requestNumber,
      });
    }

    BookingLogger.apiSuccess("POST", "/api/checkout-processing", {
      calendarEventId,
      tenant,
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    BookingLogger.apiError(
      "POST",
      "/api/checkout-processing",
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
