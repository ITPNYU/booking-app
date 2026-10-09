import { bookingCalendarStrToDate } from "@/components/src/client/utils/date";
import { CALENDAR_HIDE_STATUS } from "@/components/src/policy";
import { getCalendarClient } from "@/lib/googleClient";
import { NextResponse } from "next/server";

type CalendarDate = {
  dateTime?: string | null;
  date?: string | null;
};

export type OverlapEvent = {
  id?: string | null;
  iCalUID?: string | null;
  summary?: string | null;
  start?: CalendarDate | null;
  end?: CalendarDate | null;
};

export type OverlapCalendarClient = {
  events: {
    list: (params: {
      calendarId: string;
      timeMin: string;
      timeMax: string;
      singleEvents: boolean;
    }) => Promise<{ data: { items?: OverlapEvent[] | null } }>;
    get: (params: {
      calendarId: string;
      eventId: string;
    }) => Promise<{ data: { iCalUID?: string | null } }>;
  };
};

type BookingWindow = {
  startStr: string;
  endStr: string;
};

type RoomCalendar = {
  calendarId?: string | null;
  roomId?: string | number | null;
};

const UNAVAILABLE = "Unable to verify room availability. Please try again.";

function uniqueIds(ids: string[]): string[] {
  return [...new Set(ids.filter((id) => id.length > 0))];
}

function isNotFound(error: unknown): boolean {
  const status =
    (error as { response?: { status?: number }; code?: number })?.response
      ?.status ?? (error as { code?: number })?.code;
  return status === 404 || status === 410;
}

function timesOverlap(
  eventStart: Date,
  eventEnd: Date,
  requestStart: Date,
  requestEnd: Date,
): boolean {
  return (
    (eventStart >= requestStart && eventStart < requestEnd) ||
    (eventEnd > requestStart && eventEnd <= requestEnd) ||
    (eventStart <= requestStart && eventEnd >= requestEnd)
  );
}

function isHiddenStatus(summary: string): boolean {
  return CALENDAR_HIDE_STATUS.some((status) => summary.includes(status));
}

function isOwnEvent(
  event: OverlapEvent,
  excludeCalendarEventId?: string,
  excludeICalUID?: string,
): boolean {
  if (excludeICalUID && event.iCalUID && event.iCalUID === excludeICalUID) {
    return true;
  }
  if (!excludeCalendarEventId || !event.id) return false;
  return (
    event.id === excludeCalendarEventId ||
    event.id.startsWith(`${excludeCalendarEventId}_`)
  );
}

/**
 * Calendar ids for the rooms being booked. A room without a calendar id
 * fails the check instead of being skipped.
 */
export function calendarIdsFromRooms(
  rooms: RoomCalendar[] | null | undefined,
  options?: { required?: boolean },
): string[] {
  if (!Array.isArray(rooms)) return [];
  const required = options?.required !== false;
  const ids: string[] = [];
  for (const room of rooms) {
    if (!room?.calendarId) {
      if (required) {
        throw new Error(
          `calendarId not found for room ${room?.roomId ?? "unknown"}`,
        );
      }
      continue;
    }
    ids.push(String(room.calendarId));
  }
  return ids;
}

/**
 * Guest copies on other room calendars have a different Google event id
 * but share the primary event's iCalUID.
 */
export async function findOwnICalUID(
  calendar: OverlapCalendarClient,
  calendarEventId: string | undefined,
  calendarIds: string[],
): Promise<string | undefined> {
  if (!calendarEventId) return undefined;

  for (const calendarId of uniqueIds(calendarIds)) {
    try {
      const event = await calendar.events.get({
        calendarId,
        eventId: calendarEventId,
      });
      return event.data?.iCalUID || undefined;
    } catch (error) {
      if (isNotFound(error)) continue;
      throw error;
    }
  }

  return undefined;
}

export async function checkOverlapWithClient(
  calendar: OverlapCalendarClient,
  calendarIds: string[],
  bookingCalendarInfo: BookingWindow,
  options?: {
    excludeCalendarEventId?: string;
    sourceCalendarIds?: string[];
  },
): Promise<boolean> {
  const ids = uniqueIds(calendarIds);
  if (ids.length === 0) return false;

  const timeMin = bookingCalendarStrToDate(
    bookingCalendarInfo.startStr,
  ).toISOString();
  const timeMax = bookingCalendarStrToDate(
    bookingCalendarInfo.endStr,
  ).toISOString();
  const requestStart = new Date(timeMin);
  const requestEnd = new Date(timeMax);

  const excludeICalUID = await findOwnICalUID(
    calendar,
    options?.excludeCalendarEventId,
    [...(options?.sourceCalendarIds ?? []), ...ids],
  );

  for (const calendarId of ids) {
    const events = await calendar.events.list({
      calendarId,
      timeMin,
      timeMax,
      singleEvents: true,
    });

    const hasOverlap = events.data.items?.some((event) => {
      if (
        isOwnEvent(event, options?.excludeCalendarEventId, excludeICalUID)
      ) {
        return false;
      }

      if (isHiddenStatus(event.summary || "")) return false;

      const eventStart = new Date(
        event.start?.dateTime || event.start?.date || "",
      );
      const eventEnd = new Date(event.end?.dateTime || event.end?.date || "");
      if (
        Number.isNaN(eventStart.getTime()) ||
        Number.isNaN(eventEnd.getTime())
      ) {
        return false;
      }

      const overlaps = timesOverlap(
        eventStart,
        eventEnd,
        requestStart,
        requestEnd,
      );
      if (overlaps) {
        console.log("event that overlaps", {
          id: event.id,
          summary: event.summary,
          calendarId,
        });
      }
      return overlaps;
    });

    if (hasOverlap) return true;
  }

  return false;
}

/**
 * Live Google Calendar conflict check. Returns 409 when the slot is taken,
 * 500 when availability cannot be verified, and null when the slot is free.
 * Edit and modification pass excludeCalendarEventId so the booking's own
 * event, including guest copies, is not treated as a conflict.
 */
export async function calendarOverlapResponse(params: {
  tenant?: string;
  rooms?: RoomCalendar[] | null;
  extraCalendarIds?: string[];
  /** Rooms that may still hold the event being replaced. */
  sourceRooms?: RoomCalendar[] | null;
  bookingCalendarInfo:
    | { startStr?: string; endStr?: string }
    | null
    | undefined;
  excludeCalendarEventId?: string;
  roomIds?: Array<string | number | null | undefined>;
}): Promise<NextResponse | null> {
  const { bookingCalendarInfo } = params;
  if (!bookingCalendarInfo?.startStr || !bookingCalendarInfo?.endStr) {
    return NextResponse.json({ error: UNAVAILABLE }, { status: 500 });
  }

  try {
    const calendarIds = [
      ...calendarIdsFromRooms(params.rooms),
      ...(params.extraCalendarIds ?? []),
    ];
    const sourceCalendarIds = calendarIdsFromRooms(params.sourceRooms, {
      required: false,
    });
    if (uniqueIds(calendarIds).length === 0) return null;

    const calendar = (await getCalendarClient()) as OverlapCalendarClient;
    const hasOverlap = await checkOverlapWithClient(
      calendar,
      calendarIds,
      {
        startStr: bookingCalendarInfo.startStr,
        endStr: bookingCalendarInfo.endStr,
      },
      {
        excludeCalendarEventId: params.excludeCalendarEventId,
        sourceCalendarIds,
      },
    );
    if (!hasOverlap) return null;
    return NextResponse.json(
      { error: "Time slot no longer available" },
      { status: 409 },
    );
  } catch (err: unknown) {
    const error = err as {
      response?: { status?: number; data?: unknown };
      code?: number | string;
      errors?: unknown;
      message?: string;
    };
    console.error(
      `🚨 OVERLAP CHECK FAILED [${params.tenant?.toUpperCase() || "UNKNOWN"}]:`,
      {
        googleStatus: error?.response?.status ?? error?.code,
        googleError: JSON.stringify(
          error?.response?.data ?? error?.errors ?? error?.message,
        ),
        roomIds: params.roomIds,
        startStr: bookingCalendarInfo.startStr,
        endStr: bookingCalendarInfo.endStr,
      },
    );
    return NextResponse.json({ error: UNAVAILABLE }, { status: 500 });
  }
}
