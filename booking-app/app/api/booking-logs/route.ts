import { logServerBookingChange } from "@/lib/firebase/server/adminDb";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    const {
      bookingId,
      status,
      changedBy,
      requestNumber,
      calendarEventId,
      note,
    } = data;

    await logServerBookingChange({
      bookingId,
      status,
      changedBy,
      requestNumber,
      calendarEventId,
      note,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error logging booking change:", error);
    return NextResponse.json(
      { error: "Failed to log booking change" },
      { status: 500 },
    );
  }
}
