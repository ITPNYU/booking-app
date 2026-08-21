import {
  deleteEvent,
  insertEvent,
  updateCalendarEvent,
} from "@/components/src/server/calendars";
import { NextRequest, NextResponse } from "next/server";

import getBookingStatus from "@/components/src/client/routes/hooks/getBookingStatus";
import { DEFAULT_TENANT } from "@/components/src/constants/tenants";
import { serverBookingContents } from "@/components/src/server/admin";
import { Booking } from "@/components/src/types";
import { getCachedBookings } from "@/lib/bookingsCache";
import {
  getCachedRawCalendarEvents,
  invalidateCalendarEventsCache,
} from "@/lib/calendarEventsCache";

// Default range when the caller does not pass start/end. The client always
// sends the visible window; this is only a fallback for ad-hoc callers.
const DEFAULT_RANGE_MONTHS = 3;

// Upper bound on a requested window. The client asks for ~1.5 months; anything
// much larger (malformed caller, or someone probing the API) would reintroduce
// the multi-month fetches this endpoint was saturating on.
const MAX_RANGE_MONTHS = 6;

const getCalendarEvents = async (
  calendarId: string,
  tenant: string | undefined,
  timeMin: string,
  timeMax: string,
  fresh: boolean,
) => {
  // Raw Google events are cached per (calendarId, range); bookings come from
  // their own cache. Both are fetched in parallel.
  const [events, bookings] = await Promise.all([
    getCachedRawCalendarEvents(calendarId, timeMin, timeMax, { fresh }),
    getCachedBookings(tenant || DEFAULT_TENANT).catch(error => {
      console.error("Error fetching tenant bookings:", error);
      return [] as Booking[];
    }),
  ]);

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

    // Drop this calendar's cached ranges so other viewers on this instance see
    // the new event on their next fetch instead of pre-mutation cached data.
    invalidateCalendarEventsCache(calendarId);

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

  // Visible window: the client sends the range it is displaying. Fall back to a
  // small default range for ad-hoc callers that omit it. The fallback is
  // quantized to day granularity — a raw `new Date()` would put a unique
  // millisecond timestamp in every cache key, so no-range callers (e.g. stale
  // client bundles right after a deploy) would never hit the cache while still
  // inserting a new entry per request.
  const startParam = searchParams.get("start");
  const endParam = searchParams.get("end");
  if (
    (startParam && isNaN(Date.parse(startParam))) ||
    (endParam && isNaN(Date.parse(endParam)))
  ) {
    return NextResponse.json(
      { error: "Invalid start/end date" },
      { status: 400 },
    );
  }
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const start = startParam ? new Date(startParam) : startOfToday;
  // Anchor the fallback end to `start`, not today: a future start with no end
  // must yield a window after it, not a bogus end <= start.
  const end = endParam
    ? new Date(endParam)
    : (() => {
        const d = new Date(start);
        d.setMonth(d.getMonth() + DEFAULT_RANGE_MONTHS);
        return d;
      })();
  if (end <= start) {
    return NextResponse.json(
      { error: "end must be after start" },
      { status: 400 },
    );
  }
  // Clamp oversized windows instead of erroring so a stale client still works.
  const maxEnd = new Date(start);
  maxEnd.setMonth(maxEnd.getMonth() + MAX_RANGE_MONTHS);
  const timeMin = start.toISOString();
  const timeMax = (end > maxEnd ? maxEnd : end).toISOString();
  // `fresh=1` bypasses the calendar cache (used right after a booking changes).
  const fresh = searchParams.get("fresh") === "1";

  // Batch mode: fetch multiple calendars in one request
  if (calendarIds) {
    const ids = calendarIds.split(",").filter(Boolean);
    if (ids.length === 0) {
      return NextResponse.json({ error: "Invalid calendarIds" }, { status: 400 });
    }

    try {
      const results = await Promise.all(
        ids.map(async (id) => {
          try {
            const events = await getCalendarEvents(id, tenant, timeMin, timeMax, fresh);
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
    const events = await getCalendarEvents(calendarId, tenant, timeMin, timeMax, fresh);

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
    // The request carries no calendarId, so drop the whole cache. PUTs are
    // rare (approve/cancel-style title updates), so this is cheap.
    invalidateCalendarEventsCache();
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
    invalidateCalendarEventsCache(calendarId);
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
