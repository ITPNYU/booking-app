import { NextRequest, NextResponse } from "next/server";

import { TableNames } from "@/components/src/policy";
import { serverUpdateDataByCalendarEventId } from "@/components/src/server/admin";
import { BookingStatusLabel } from "@/components/src/types";
import {
  logServerBookingChange,
  serverGetDataByCalendarEventId,
} from "@/lib/firebase/server/adminDb";
import * as admin from "firebase-admin";

export async function POST(req: NextRequest) {
  const { id, email, action } = await req.json();
  try {
    const booking = await serverGetDataByCalendarEventId(
      TableNames.BOOKING,
      id,
    );
    if (!booking) {
      throw new Error("Booking not found");
    }

    if (action === "SEND_TO_EQUIPMENT") {
      // Update booking record with equipment timestamp
      await serverUpdateDataByCalendarEventId(
        TableNames.BOOKING,
        booking.calendarEventId,
        {
          equipmentAt: admin.firestore.Timestamp.now(),
          equipmentBy: email,
        },
      );

      await logServerBookingChange({
        bookingId: booking.calendarEventId,
        calendarEventId: booking.calendarEventId,
        status: BookingStatusLabel.EQUIPMENT,
        changedBy: email,
        requestNumber: booking.requestNumber,
      });

      return NextResponse.json(
        { message: "Sent to equipment successfully" },
        { status: 200 },
      );
    } else if (action === "EQUIPMENT_APPROVE") {
      // Update booking record with equipment approval timestamp
      await serverUpdateDataByCalendarEventId(
        TableNames.BOOKING,
        booking.calendarEventId,
        {
          equipmentApprovedAt: admin.firestore.Timestamp.now(),
          equipmentApprovedBy: email,
        },
      );

      await logServerBookingChange({
        bookingId: booking.calendarEventId,
        calendarEventId: booking.calendarEventId,
        status: BookingStatusLabel.APPROVED,
        changedBy: email,
        requestNumber: booking.requestNumber,
      });

      return NextResponse.json(
        { message: "Equipment approved successfully" },
        { status: 200 },
      );
    } else {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }
  } catch (error) {
    console.error(
      "Error processing equipment request",
      { booking_id: String(id), error },
    );
    return NextResponse.json(
      { error: error.message },
      { status: error.status || 500 },
    );
  }
}
