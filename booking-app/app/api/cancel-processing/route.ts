import { deleteBookingCalendarEvents } from "@/components/src/server/calendars";
import { processCancelBooking } from "@/components/src/server/db";
import {
  serverGetDataByCalendarEventId,
} from "@/lib/firebase/server/adminDb";
import { TableNames } from "@/components/src/policy";
import { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { calendarEventId, email, netId, tenant } = await req.json();

    console.log(
      `🔄 CANCEL PROCESSING API CALLED [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
      {
        calendarEventId,
        email,
        netId,
        tenant,
      },
    );

    // Call the shared cancel processing function
    await processCancelBooking(calendarEventId, email, netId, tenant);

    // Delete calendar events from Google Calendar for CANCELED bookings
    // This ensures true availability is reflected in the Google Calendar UI
    try {
      // Get booking information to find room IDs
      const booking = (await serverGetDataByCalendarEventId(
        TableNames.BOOKING,
        calendarEventId,
        tenant,
      )) as any;
      if (!booking) {
        console.error(
          "Booking not found for calendarEventId:",
          calendarEventId,
        );
      } else {
        await deleteBookingCalendarEvents(
          calendarEventId,
          booking.roomId,
          tenant,
        );
      }
    } catch (error) {
      console.error(
        `🚨 CANCEL CALENDAR DELETION FAILED [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
        {
          calendarEventId,
          error: error.message,
        },
      );
      // Don't throw error - calendar deletion failure shouldn't prevent booking cancellation
    }

    console.log(
      `✅ CANCEL PROCESSING API SUCCESS [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
      {
        calendarEventId,
        email,
        netId,
      },
    );

    return Response.json({ success: true });
  } catch (error) {
    console.error("🚨 CANCEL PROCESSING API ERROR:", {
      error: error.message,
      stack: error.stack,
    });

    return Response.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
