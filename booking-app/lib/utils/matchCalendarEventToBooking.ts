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

function bookingIncludesRoom(
  booking: MatchableBooking,
  roomIdsForCalendar: string[],
): boolean {
  if (!booking.roomId || roomIdsForCalendar.length === 0) return false;
  const bookingRoomIds = booking.roomId.split(",").map((roomId) => roomId.trim());
  return roomIdsForCalendar.some((roomId) => bookingRoomIds.includes(roomId));
}

function isSameSlot(
  booking: MatchableBooking,
  eventStart: number,
  eventEnd: number,
): boolean {
  const bookingStart = bookingTimeMillis(booking.startDate);
  const bookingEnd = bookingTimeMillis(booking.endDate);
  if (bookingStart == null || bookingEnd == null) return false;
  return (
    Math.abs(bookingStart - eventStart) < SLOT_FUZZ_MS &&
    Math.abs(bookingEnd - eventEnd) < SLOT_FUZZ_MS
  );
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
  bookings: T[],
  roomIdsForCalendar: string[],
): T | undefined {
  const eventId = event.id || "";
  if (eventId) {
    const byId = bookings.find(
      (booking) => booking.calendarEventId === eventId,
    );
    if (byId) return byId;
  }

  const eventStart = calendarEventTimeMillis(event.start);
  const eventEnd = calendarEventTimeMillis(event.end);
  if (eventStart == null || eventEnd == null) return undefined;

  const slotMatches = bookings.filter(
    (booking) =>
      bookingIncludesRoom(booking, roomIdsForCalendar) &&
      isSameSlot(booking, eventStart, eventEnd),
  );

  return slotMatches.length === 1 ? slotMatches[0] : undefined;
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
