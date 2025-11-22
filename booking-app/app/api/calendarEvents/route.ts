import {
  deleteEvent,
  insertEvent,
  updateCalendarEvent,
} from "@/components/src/server/calendars";
import { NextRequest, NextResponse } from "next/server";

import { serverBookingContents } from "@/components/src/server/admin";
import { getCalendarClient } from "@/lib/googleClient";
import { calendar_v3 } from "googleapis/build/src/apis/calendar";

const getCalendarEvents = async (calendarId: string) => {
  const now = new Date().toISOString();
  const endOfRange = new Date();
  endOfRange.setMonth(endOfRange.getMonth() + 12);
  const endOfRangeISOString = endOfRange.toISOString();

  let events: calendar_v3.Schema$Event[] = [];
  const calendar = await getCalendarClient();
  let pageToken: string | undefined = undefined;

  do {
    const res = await calendar.events.list({
      calendarId,
      timeMin: now,
      timeMax: endOfRangeISOString,
      singleEvents: true,
      orderBy: "startTime",
      maxResults: 1000,
      pageToken,
    });

    if (res.data.items) {
      events.push(...res.data.items);
    }
    pageToken = res.data.nextPageToken || undefined;
  } while (pageToken);

  return events.map(e => ({
    title: e.summary,
    start: e.start?.dateTime || e.start?.date,
    end: e.end?.dateTime || e.end?.date,
    calendarEventId: e.id,
  }));
};

export async function POST(request: NextRequest) {
  const { calendarId, title, description, startTime, endTime, roomEmails } =
    await request.json();
  console.log(calendarId, title, description, startTime, endTime, roomEmails);

  if (
    !calendarId ||
    !title ||
    !description ||
    !startTime ||
    !endTime ||
    !roomEmails
  ) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 },
    );
  }

  try {
    const event = await insertEvent({
      calendarId,
      title,
      description,
      startTime,
      endTime,
      roomEmails,
    });

    return NextResponse.json({ calendarEventId: event.id }, { status: 200 });
  } catch (error) {
    console.error("Error adding event to calendar:", error);
    return NextResponse.json(
      { error: "Failed to add event to calendar" },
      { status: 500 },
    );
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const calendarId = searchParams.get("calendarId");

  if (!calendarId) {
    return NextResponse.json({ error: "Invalid calendarId" }, { status: 400 });
  }

  try {
    const events = await getCalendarEvents(calendarId);
    const res = NextResponse.json(events);
    res.headers.set(
      "Cache-Control",
      "no-store, no-cache, must-revalidate, proxy-revalidate",
    );
    res.headers.set("Expires", "0");
    return res;
  } catch (error) {
    console.error("Error fetching calendar events:", error);
    return NextResponse.json(
      { error: "Failed to fetch calendar events" },
      { status: 500 },
    );
  }
}

export async function PUT(req: NextRequest) {
  const { calendarEventId, newValues } = await req.json();

  if (!calendarEventId || !newValues) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 },
    );
  }
  const contents = await serverBookingContents(calendarEventId);
  try {
    await updateCalendarEvent(calendarEventId, newValues, contents);
    return NextResponse.json(
      { message: "Event updated successfully" },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error updating event:", error);
    return NextResponse.json(
      { error: "Failed to update event" },
      { status: 500 },
    );
  }
}

export async function DELETE(req: NextRequest) {
  const { calendarId, calendarEventId } = await req.json();
  if (!calendarId || !calendarEventId) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 },
    );
  }
  try {
    await deleteEvent(calendarId, calendarEventId);
    return NextResponse.json(
      { message: "Event deleted successfully" },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error deleting event:", error);
    return NextResponse.json(
      { error: "Failed to delete event" },
      { status: 500 },
    );
  }
}
