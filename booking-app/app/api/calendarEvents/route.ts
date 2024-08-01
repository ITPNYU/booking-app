import { NextRequest, NextResponse } from "next/server";
import { getCalendarClient } from "@/lib/googleClient";
import {
  insertEvent,
  updateEventPrefix,
} from "@/components/src/server/calendars";
import { bookingContents } from "@/components/src/server/admin";
import { BookingFormDetails } from "@/components/src/types";

const getCalendarEvents = async (calendarId: string) => {
  const calendar = await getCalendarClient();
  const now = new Date().toISOString();
  const threeMonthsFromNow = new Date();
  threeMonthsFromNow.setMonth(threeMonthsFromNow.getMonth() + 3);
  const threeMonthsFromNowISOString = threeMonthsFromNow.toISOString();

  const res = await calendar.events.list({
    calendarId,
    timeMin: now,
    timeMax: threeMonthsFromNowISOString,
    singleEvents: true,
    orderBy: "startTime",
  });

  const events = res.data.items || [];

  const formattedEvents = events.map(e => ({
    title: e.summary,
    start: e.start?.dateTime || e.start?.date,
    end: e.end?.dateTime || e.end?.date,
  }));

  return formattedEvents;
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
    return NextResponse.json(events);
  } catch (error) {
    console.error("Error fetching calendar events:", error);
    return NextResponse.json(
      { error: "Failed to fetch calendar events" },
      { status: 500 },
    );
  }
}

export async function PUT(req: NextRequest) {
  const { calendarEventId, newPrefix } = await req.json();

  if (!calendarEventId || !newPrefix) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 },
    );
  }
  const contents = await bookingContents(calendarEventId);
  console.log("contents", contents);
  try {
    await updateEventPrefix(calendarEventId, newPrefix, contents);
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
