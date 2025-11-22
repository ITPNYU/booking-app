import { NextRequest, NextResponse } from "next/server";
import { inviteUserToCalendarEvent } from "@/components/src/server/calendars";

export async function POST(request: NextRequest) {
  const { calendarEventId, guestEmail, roomId } = await request.json();
  try {
    await inviteUserToCalendarEvent(
      calendarEventId,
      guestEmail,
      parseInt(roomId, 10),
    );
    return NextResponse.json({ calendarEventId }, { status: 200 });
  } catch (error) {
    console.error("Error adding event to calendar:", error);
    return NextResponse.json(
      { error: "Failed to add event to calendar" },
      { status: 500 },
    );
  }
}
