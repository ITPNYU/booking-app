import {
  deleteEvent,
  insertEvent,
  updateCalendarEvent,
} from "@/components/src/server/calendars";
import { NextRequest, NextResponse } from "next/server";

import { getTenantRooms } from "@/app/api/bookings/shared";
import getBookingStatus from "@/components/src/client/routes/hooks/getBookingStatus";
import { DEFAULT_TENANT } from "@/components/src/constants/tenants";
import { serverBookingContents } from "@/components/src/server/admin";
import { Booking } from "@/components/src/types";
import { getCachedBookings } from "@/lib/bookingsCache";
import { getCalendarClient } from "@/lib/googleClient";
import {
  BookingMatchIndex,
  buildBookingMatchIndex,
  findBookingForCalendarEvent,
  roomIdsByCalendarId,
} from "@/lib/utils/matchCalendarEventToBooking";
import { calendar_v3 } from "googleapis/build/src/apis/calendar";

const listGoogleCalendarEvents = async (calendarId: string) => {
  const now = new Date().toISOString();
  const endOfRange = new Date();
  endOfRange.setMonth(endOfRange.getMonth() + 12);
  const endOfRangeISOString = endOfRange.toISOString();

  const events: calendar_v3.Schema$Event[] = [];
  const calendar = await getCalendarClient();
  let pageToken: string | undefined;

  do {
    const res = await calendar.events.list({
      calendarId,
      timeMin: now,
      timeMax: endOfRangeISOString,
      singleEvents: true,
      orderBy: "startTime",
      maxResults: 250,
      pageToken,
      fields:
        "nextPageToken,items(id,summary,start(dateTime,date),end(dateTime,date))",
    });

    if (res.data.items) {
      events.push(...res.data.items);
    }
    pageToken = res.data.nextPageToken || undefined;
  } while (pageToken);

  return events;
};

const loadBookingMatchIndex = async (tenant?: string) => {
  const bookings = await getCachedBookings(tenant || DEFAULT_TENANT).catch(
    (error) => {
      console.error("Error fetching tenant bookings:", error);
      return [] as Booking[];
    },
  );
  return buildBookingMatchIndex(bookings);
};

const mapEventsToResponse = (
  events: calendar_v3.Schema$Event[],
  index: BookingMatchIndex<Booking>,
  roomIdsForCalendar: string[],
) =>
  events.map((e) => {
    const booking = findBookingForCalendarEvent(
      e,
      index,
      roomIdsForCalendar,
    );
    return {
      title: e.summary,
      start: e.start?.dateTime || e.start?.date,
      end: e.end?.dateTime || e.end?.date,
      // Prefer the Firestore booking id so guest copies on other room
      // calendars still identify as the same reservation.
      calendarEventId: booking?.calendarEventId || e.id,
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

const getCalendarEvents = async (
  calendarId: string,
  indexPromise: Promise<BookingMatchIndex<Booking>>,
  roomsPromise: Promise<Map<string, string[]>>,
) => {
  const [events, index, roomsByCalendarId] = await Promise.all([
    listGoogleCalendarEvents(calendarId),
    indexPromise,
    roomsPromise,
  ]);
  return mapEventsToResponse(
    events,
    index,
    roomsByCalendarId.get(calendarId) ?? [],
  );
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
  const calendarIds = searchParams.get("calendarIds");

  // Get tenant from x-tenant header, fallback to 'mc' as default
  const tenant = req.headers.get("x-tenant") || DEFAULT_TENANT;

  // Batch mode: fetch multiple calendars in one request
  if (calendarIds) {
    const ids = calendarIds.split(",").filter(Boolean);
    if (ids.length === 0) {
      return NextResponse.json({ error: "Invalid calendarIds" }, { status: 400 });
    }

    try {
      const indexPromise = loadBookingMatchIndex(tenant);
      const roomsPromise = getTenantRooms(tenant).then(roomIdsByCalendarId);
      const results = await Promise.all(
        ids.map(async (id) => {
          try {
            const events = await getCalendarEvents(
              id,
              indexPromise,
              roomsPromise,
            );
            return { calendarId: id, events };
          } catch (error) {
            console.error("Error fetching calendar events for calendarId:", id, error);
            return { calendarId: id, events: [] };
          }
        }),
      );

      const grouped: Record<string, any[]> = {};
      for (const { calendarId, events } of results) {
        grouped[calendarId] = events;
      }

      const res = NextResponse.json(grouped);
      res.headers.set(
        "Cache-Control",
        "private, max-age=60, stale-while-revalidate=120",
      );
      return res;
    } catch (error) {
      console.error("Error fetching batch calendar events:", error);
      return NextResponse.json(
        { error: "Failed to fetch calendar events" },
        { status: 500 },
      );
    }
  }

  // Single calendar mode (backwards compatible)
  if (!calendarId) {
    return NextResponse.json({ error: "Invalid calendarId" }, { status: 400 });
  }

  try {
    const events = await getCalendarEvents(
      calendarId,
      loadBookingMatchIndex(tenant),
      getTenantRooms(tenant).then(roomIdsByCalendarId),
    );

    const res = NextResponse.json(events);
    res.headers.set(
      "Cache-Control",
      "private, max-age=60, stale-while-revalidate=120",
    );
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
    await updateCalendarEvent(calendarEventId, newValues, contents, tenant);
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
