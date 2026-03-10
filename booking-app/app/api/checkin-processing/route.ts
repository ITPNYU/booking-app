import { TableNames } from "@/components/src/policy";
import { serverUpdateDataByCalendarEventId } from "@/components/src/server/admin";
import { BookingStatusLabel } from "@/components/src/types";
import {
  logServerBookingChange,
  serverGetDataByCalendarEventId,
} from "@/lib/firebase/server/adminDb";
import * as admin from "firebase-admin";
import { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { calendarEventId, email, tenant } = await req.json();

    console.log(
      `[checkin-processing] started [${tenant?.toUpperCase() || "UNKNOWN"}]`,
      { calendarEventId, email },
    );

    // Set check-in timestamps
    const checkedInAt = admin.firestore.Timestamp.now();
    const updateData: Record<string, any> = {
      checkedInAt,
    };
    if (email) {
      updateData.checkedInBy = email;
    }

    await serverUpdateDataByCalendarEventId(
      TableNames.BOOKING,
      calendarEventId,
      updateData,
      tenant,
    );

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
          `[checkin-processing] calendar update failed [${tenant?.toUpperCase() || "UNKNOWN"}]`,
          { calendarEventId, status: response.status },
        );
      }
    } catch (error) {
      console.error(
        `[checkin-processing] calendar update error [${tenant?.toUpperCase() || "UNKNOWN"}]`,
        {
          calendarEventId,
          error: error instanceof Error ? error.message : String(error),
        },
      );
    }

    // Log booking history
    const bookingDoc = await serverGetDataByCalendarEventId<any>(
      TableNames.BOOKING,
      calendarEventId,
      tenant,
    );

    if (bookingDoc) {
      try {
        await logServerBookingChange({
          bookingId: bookingDoc.id,
          calendarEventId,
          status: BookingStatusLabel.CHECKED_IN,
          changedBy: email || "system",
          requestNumber: bookingDoc.requestNumber || 0,
          note: "",
          tenant,
        });
      } catch (error) {
        console.error(
          `[checkin-processing] history log failed [${tenant?.toUpperCase() || "UNKNOWN"}]`,
          {
            calendarEventId,
            error: error instanceof Error ? error.message : String(error),
          },
        );
      }
    }

    console.log(
      `[checkin-processing] completed [${tenant?.toUpperCase() || "UNKNOWN"}]`,
      { calendarEventId },
    );

    return Response.json({ success: true });
  } catch (error) {
    console.error("[checkin-processing] error:", {
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
