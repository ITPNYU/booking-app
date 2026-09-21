import { serializedTimestampToMillis } from "@/lib/utils/timestampWire";

const SLOT_FUZZ_MS = 60 * 1000;

export type CalendarEventTime = {
  dateTime?: string | null;
  date?: string | null;
};

export type MatchableCalendarEvent = {
  id?: string | null;
  start?: CalendarEventTime | string | Date | null;
  end?: CalendarEventTime | string | Date | null;
};

export type MatchableBooking = {
  calendarEventId?: string;
  roomId?: string;
  startDate?: unknown;
  endDate?: unknown;
};

type SlotEntry<T> = {
  booking: T;
  start: number;
  end: number;
};

export type BookingMatchIndex<T extends MatchableBooking> = {
  byId: Map<string, T>;
  byRoomSlot: Map<string, SlotEntry<T>[]>;
};

export function bookingTimeMillis(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (value instanceof Date) {
    const millis = value.getTime();
    return Number.isNaN(millis) ? null : millis;
  }
  if (typeof value === "object") {
    const obj = value as { toMillis?: () => number; toDate?: () => Date };
    if (typeof obj.toMillis === "function") {
      try {
        const millis = obj.toMillis();
        return Number.isFinite(millis) ? millis : null;
      } catch {
        // fall through
      }
    }
    if (typeof obj.toDate === "function") {
      try {
        const millis = obj.toDate().getTime();
        return Number.isNaN(millis) ? null : millis;
      } catch {
        // fall through
      }
    }
    const serialized = serializedTimestampToMillis(value);
    if (serialized != null) return serialized;
  }
  if (typeof value === "string") {
    const millis = Date.parse(value);
    return Number.isNaN(millis) ? null : millis;
  }
  return null;
}

function calendarEventTimeMillis(
  value: MatchableCalendarEvent["start"],
): number | null {
  if (value == null) return null;
  if (typeof value === "string" || value instanceof Date) {
    return bookingTimeMillis(value);
  }
  return bookingTimeMillis(value.dateTime || value.date);
}

function timeBucket(ms: number): number {
  return Math.floor(ms / SLOT_FUZZ_MS);
}

function roomSlotKey(
  roomId: string,
  startBucket: number,
  endBucket: number,
): string {
  return `${roomId}:${startBucket}:${endBucket}`;
}

function timesMatch(
  bookingStart: number,
  bookingEnd: number,
  eventStart: number,
  eventEnd: number,
): boolean {
  return (
    Math.abs(bookingStart - eventStart) < SLOT_FUZZ_MS &&
    Math.abs(bookingEnd - eventEnd) < SLOT_FUZZ_MS
  );
}

/**
 * Build lookup structures once per request so each calendar event can be
 * resolved in O(1) instead of scanning every booking.
 */
export function buildBookingMatchIndex<T extends MatchableBooking>(
  bookings: T[],
): BookingMatchIndex<T> {
  const byId = new Map<string, T>();
  const byRoomSlot = new Map<string, SlotEntry<T>[]>();

  for (const booking of bookings) {
    if (booking.calendarEventId) {
      byId.set(booking.calendarEventId, booking);
    }

    const start = bookingTimeMillis(booking.startDate);
    const end = bookingTimeMillis(booking.endDate);
    if (start == null || end == null || !booking.roomId) continue;

    const startBucket = timeBucket(start);
    const endBucket = timeBucket(end);
    const roomIds = booking.roomId
      .split(",")
      .map((roomId) => roomId.trim())
      .filter(Boolean);
    const entry: SlotEntry<T> = { booking, start, end };

    for (const roomId of roomIds) {
      const key = roomSlotKey(roomId, startBucket, endBucket);
      const list = byRoomSlot.get(key);
      if (list) list.push(entry);
      else byRoomSlot.set(key, [entry]);
    }
  }

  return { byId, byRoomSlot };
}

/**
 * Resolve a Google Calendar event to the Firestore booking it represents.
 *
 * Guest copies on other room calendars get a different Google event id than
 * the primary event stored on the booking. Match those by room + time, but
 * only when exactly one booking occupies that slot — otherwise leave the
 * event unmatched so a real conflict cannot be hidden as "our own copy".
 */
export function findBookingForCalendarEvent<T extends MatchableBooking>(
  event: MatchableCalendarEvent,
  index: BookingMatchIndex<T>,
  roomIdsForCalendar: string[],
): T | undefined {
  const eventId = event.id || "";
  if (eventId) {
    const byId = index.byId.get(eventId);
    if (byId) return byId;
  }

  if (roomIdsForCalendar.length === 0) return undefined;

  const eventStart = calendarEventTimeMillis(event.start);
  const eventEnd = calendarEventTimeMillis(event.end);
  if (eventStart == null || eventEnd == null) return undefined;

  const startBucket = timeBucket(eventStart);
  const endBucket = timeBucket(eventEnd);
  const matches = new Set<T>();

  for (const roomId of roomIdsForCalendar) {
    for (let startOffset = -1; startOffset <= 1; startOffset++) {
      for (let endOffset = -1; endOffset <= 1; endOffset++) {
        const entries = index.byRoomSlot.get(
          roomSlotKey(
            roomId,
            startBucket + startOffset,
            endBucket + endOffset,
          ),
        );
        if (!entries) continue;
        for (const entry of entries) {
          if (timesMatch(entry.start, entry.end, eventStart, eventEnd)) {
            matches.add(entry.booking);
          }
        }
      }
    }
  }

  if (matches.size !== 1) return undefined;
  return matches.values().next().value;
}

export function roomIdsByCalendarId(
  rooms: { roomId?: string | number; calendarId?: string }[],
): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const room of rooms) {
    if (!room.calendarId) continue;
    const list = map.get(room.calendarId) ?? [];
    list.push(String(room.roomId));
    map.set(room.calendarId, list);
  }
  return map;
}
