import { Booking, BookingStatus } from "@/components/src/types";
import { NextRequest, NextResponse } from "next/server";

import { TableNames } from "@/components/src/policy";
import { parse } from "json2csv";
import { serverFetchAllDataFromCollection } from "@/lib/firebase/server/adminDb";

export async function GET(request: NextRequest) {
  const bookings = await serverFetchAllDataFromCollection<Booking>(
    TableNames.BOOKING,
  );
  const statuses = await serverFetchAllDataFromCollection<BookingStatus>(
    TableNames.BOOKING_STATUS,
  );

  // need to find corresponding status row for booking row
  const idsToData: {
    [key: string]: {
      booking: Booking;
      status: BookingStatus;
    };
  } = {};

  for (let booking of bookings) {
    const calendarEventId = booking.calendarEventId;
    const statusMatch = statuses.filter(
      row => row.calendarEventId === calendarEventId,
    )[0];
    idsToData[calendarEventId] = {
      booking,
      status: statusMatch,
    };
  }

  const rows = Object.entries(idsToData)
    .map(([_, { booking, status }]) => {
      const { requestNumber, ...otherBooking } = booking;
      return { requestNumber, ...otherBooking, ...status };
    })
    .sort((a, b) => a.requestNumber - b.requestNumber);

  try {
    const csv = parse(rows);
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": 'attachment; filename="data.csv"',
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch CSV data" },
      { status: 400 },
    );
  }
}
