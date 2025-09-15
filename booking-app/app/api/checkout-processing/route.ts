import { NextRequest, NextResponse } from "next/server";
import { TableNames } from "@/components/src/policy";
import { BookingStatusLabel } from "@/components/src/types";
import { serverGetDataByCalendarEventId } from "@/lib/firebase/server/adminDb";
import { serverSendBookingDetailEmail } from "@/components/src/server/admin";

export async function POST(request: NextRequest) {
  const { calendarEventId, email, tenant } = await request.json();

  console.log(
    `🎯 CHECKOUT PROCESSING REQUEST [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
    {
      calendarEventId,
      email,
      tenant,
    },
  );

  try {
    // Handle checkout side effects:
    // 1. Send checkout email
    // 2. Update calendar event
    // Note: History logging is handled by checkOut function in db.ts
    // XState transition is already completed when this API is called

    const doc = await serverGetDataByCalendarEventId<{
      id: string;
      requestNumber: number;
      email?: string;
    }>(TableNames.BOOKING, calendarEventId, tenant);

    if (doc) {
      // 1. Send checkout email to guest
      if (doc.email) {
        const headerMessage =
          "Your reservation request for Media Commons has been checked out. Thank you for choosing Media Commons.";

        await serverSendBookingDetailEmail({
          calendarEventId,
          targetEmail: doc.email,
          headerMessage,
          status: BookingStatusLabel.CHECKED_OUT,
          tenant,
        });

        console.log(
          `📧 CHECKOUT EMAIL SENT [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
          {
            calendarEventId,
            guestEmail: doc.email,
          },
        );
      } else {
        console.warn(
          `⚠️ CHECKOUT EMAIL SKIPPED - NO EMAIL IN BOOKING [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
          {
            calendarEventId,
            bookingId: doc.id,
          },
        );
      }

      // 2. Update calendar event with CHECKED_OUT status
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
          console.log(
            `📅 CALENDAR UPDATED [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
            {
              calendarEventId,
              status: BookingStatusLabel.CHECKED_OUT,
            },
          );
        } else {
          console.error(
            `🚨 CALENDAR UPDATE FAILED [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
            {
              calendarEventId,
              status: response.status,
              statusText: response.statusText,
            },
          );
        }
      } catch (calendarError) {
        console.error(
          `🚨 CALENDAR UPDATE ERROR [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
          {
            calendarEventId,
            error: calendarError.message,
          },
        );
      }
    }

    console.log(
      `✅ CHECKOUT PROCESSING SUCCESS [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
      {
        calendarEventId,
        email,
      },
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(
      `🚨 CHECKOUT PROCESSING FAILED [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
      {
        calendarEventId,
        email,
        tenant,
        error: error.message,
      },
    );

    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
