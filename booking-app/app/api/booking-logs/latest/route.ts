import { DEFAULT_TENANT } from "@/components/src/constants/tenants";
import { BookingStatusLabel } from "@/components/src/types";
import { getLatestBookingStatusLogs } from "@/lib/firebase/server/adminDb";
import { NextRequest, NextResponse } from "next/server";

const MAX_BOOKING_LOG_BATCH_SIZE = 200;

type BookingLogRequest = {
  calendarEventId?: unknown;
  status?: unknown;
};

function isBookingLogRequest(
  request: BookingLogRequest,
): request is { calendarEventId: string; status: BookingStatusLabel } {
  return (
    typeof request.calendarEventId === "string" &&
    request.calendarEventId.length > 0 &&
    typeof request.status === "string" &&
    Object.values(BookingStatusLabel).includes(
      request.status as BookingStatusLabel,
    )
  );
}

export async function POST(req: NextRequest) {
  try {
    const { bookings } = await req.json();
    const tenant = req.headers.get("x-tenant") || DEFAULT_TENANT;

    if (!Array.isArray(bookings)) {
      return NextResponse.json(
        { error: "bookings must be an array" },
        { status: 400 },
      );
    }

    if (bookings.length > MAX_BOOKING_LOG_BATCH_SIZE) {
      return NextResponse.json(
        {
          error: `booking log batch size must be ${MAX_BOOKING_LOG_BATCH_SIZE} or fewer`,
        },
        { status: 413 },
      );
    }

    const validBookings = bookings.filter(isBookingLogRequest);
    if (validBookings.length !== bookings.length) {
      return NextResponse.json(
        {
          error: "Each booking must include a valid calendarEventId and status",
        },
        { status: 400 },
      );
    }

    const latestLogs = await getLatestBookingStatusLogs(validBookings, tenant);
    return NextResponse.json(latestLogs, { status: 200 });
  } catch (error) {
    console.error("Error fetching latest booking logs:", error);
    return NextResponse.json(
      { error: "Failed to fetch latest booking logs" },
      { status: 500 },
    );
  }
}
