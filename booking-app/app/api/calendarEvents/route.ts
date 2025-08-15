import {
  deleteEvent,
  insertEvent,
  updateCalendarEvent,
} from "@/components/src/server/calendars";
import { NextRequest, NextResponse } from "next/server";

import getBookingStatus from "@/components/src/client/routes/hooks/getBookingStatus";
import { DEFAULT_TENANT } from "@/components/src/constants/tenants";
import { TableNames } from "@/components/src/policy";
import { serverBookingContents } from "@/components/src/server/admin";
import { Booking } from "@/components/src/types";
import { serverFetchAllDataFromCollection } from "@/lib/firebase/server/adminDb";
import { getCalendarClient } from "@/lib/googleClient";
import { calendar_v3 } from "googleapis/build/src/apis/calendar";

const getCalendarEvents = async (calendarId: string, tenant?: string) => {
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

  // Get tenant-specific booking data to enrich calendar events
  let bookings: Booking[] = [];
  try {
    bookings = await serverFetchAllDataFromCollection<Booking>(
      TableNames.BOOKING,
      [],
      tenant,
    );
  } catch (error) {
    console.error("Error fetching tenant bookings:", error);
  }

  // Create a map of calendarEventId to booking for quick lookup
  const bookingMap = new Map<string, Booking>();
  bookings.forEach(booking => {
    if (booking.calendarEventId) {
      bookingMap.set(booking.calendarEventId, booking);
    }
  });

  return events.map(e => {
    const booking = bookingMap.get(e.id || "");
    return {
      title: e.summary,
      start: e.start?.dateTime || e.start?.date,
      end: e.end?.dateTime || e.end?.date,
      calendarEventId: e.id,
      // Add booking information if available
      booking: booking
        ? {
            status: getBookingStatus(booking),
            requestNumber: booking.requestNumber,
            email: booking.email,
            department: booking.department,
          }
        : undefined,
    };
  });
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

  // Get tenant from x-tenant header, fallback to 'mc' as default
  const tenant = req.headers.get("x-tenant") || DEFAULT_TENANT;

  if (!calendarId) {
    return NextResponse.json({ error: "Invalid calendarId" }, { status: 400 });
  }

  try {
    console.log(
      `Fetching calendar events for calendarId: ${calendarId}, tenant: ${tenant}`,
    );
    const events = await getCalendarEvents(calendarId, tenant);
    console.log(
      `Returning ${events.length} events for calendarId: ${calendarId}, tenant: ${tenant}`,
    );
    console.log(
      `Events with booking data:`,
      events
        .filter(e => e.booking)
        .map(e => ({
          calendarEventId: e.calendarEventId,
          title: e.title,
          booking: e.booking,
        })),
    );

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

  // Get tenant from x-tenant header, fallback to 'mc' as default
  const tenant = req.headers.get("x-tenant") || DEFAULT_TENANT;

  if (!calendarEventId || !newValues) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 },
    );
  }

  try {
    const contents = await serverBookingContents(calendarEventId, tenant);
    await updateCalendarEvent(calendarEventId, newValues, contents);
    return NextResponse.json(
      { message: "Event updated successfully" },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error updating event for tenant:", tenant, error);
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
