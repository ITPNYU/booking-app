import { inviteUserToCalendarEvent } from "@/components/src/server/calendars";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const { calendarEventId, guestEmail, roomId } = await request.json();

  // Get tenant from x-tenant header for logging purposes
  const tenant = request.headers.get("x-tenant") || "mc";

  try {
    console.log(
      `Inviting user to calendar event for tenant: ${tenant}, calendarEventId: ${calendarEventId}, guest: ${guestEmail}`,
    );
    await inviteUserToCalendarEvent(
      calendarEventId,
      guestEmail,
      parseInt(roomId, 10),
    );
    return NextResponse.json({ calendarEventId }, { status: 200 });
  } catch (error) {
    console.error(
      `Error adding event to calendar for tenant: ${tenant}:`,
      error,
    );
    return NextResponse.json(
      { error: "Failed to add event to calendar" },
      { status: 500 },
    );
  }
}
