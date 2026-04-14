import { deleteBookingCalendarEvents } from "@/components/src/server/calendars";
import { TableNames } from "@/components/src/policy";
import { DEFAULT_TENANT } from "@/components/src/constants/tenants";
import { serverGetDataByCalendarEventId } from "@/lib/firebase/server/adminDb";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const calendarEventId = body?.calendarEventId as string | undefined;
    const tenant = (body?.tenant as string | undefined) || DEFAULT_TENANT;

    if (!calendarEventId) {
      return NextResponse.json(
        { success: false, error: "Missing calendarEventId" },
        { status: 400 },
      );
    }

    const booking = (await serverGetDataByCalendarEventId<any>(
      TableNames.BOOKING,
      calendarEventId,
      tenant,
    )) as any;

    if (!booking) {
      return NextResponse.json(
        { success: false, error: "Booking not found" },
        { status: 404 },
      );
    }

    await deleteBookingCalendarEvents(calendarEventId, booking.roomId, tenant);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("🚨 deleteBookingCalendarEvents API ERROR:", {
      error: error?.message,
      stack: error?.stack,
    });
    return NextResponse.json(
      { success: false, error: error?.message || "Unknown error" },
      { status: 500 },
    );
  }
}

