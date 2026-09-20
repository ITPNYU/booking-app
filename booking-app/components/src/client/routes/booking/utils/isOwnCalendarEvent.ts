type EventLike = {
  id?: string;
  calendarEventId?: string;
  start?: string | Date;
  end?: string | Date;
  resourceId?: string | number;
  extendedProps?: { calendarEventId?: string };
};

type BookingSlotLike = {
  calendarEventId?: string;
  roomId?: string;
  startDate?: { toDate?: () => Date };
  endDate?: { toDate?: () => Date };
};

export function normalizeCalendarEventId(
  calendarEventId?: string | string[] | null,
): string | undefined {
  if (calendarEventId == null) return undefined;
  const raw = Array.isArray(calendarEventId)
    ? calendarEventId[0]
    : calendarEventId;
  if (!raw) return undefined;
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

/**
 * True when a timeline event is the reservation currently being edited
 * or modified, so it must not block selecting a new time.
 *
 * fetchCalendarEvents encodes ids as `${calendarEventId}:${roomId}:${start}`.
 * Start timestamps contain colons, so matching by prefix is required instead
 * of taking split(":")[0] alone.
 */
export function isOwnCalendarEvent(
  event: EventLike,
  calendarEventId?: string | string[] | null,
): boolean {
  const target = normalizeCalendarEventId(calendarEventId);
  if (!target) return false;

  const eventCalId = event.calendarEventId || event.extendedProps?.calendarEventId;
  if (
    eventCalId &&
    (eventCalId === target || eventCalId.startsWith(`${target}_`))
  ) {
    return true;
  }

  const eventId = event.id;
  if (!eventId) return false;
  if (eventId === target) return true;
  if (eventId.startsWith(`${target}:`)) return true;
  if (eventId.startsWith(`${target}_`)) return true;
  return false;
}

/** True when an event occupies the same room and time as a booking. */
export function isSameSlotAsBooking(
  event: EventLike,
  booking?: BookingSlotLike,
): boolean {
  if (!booking?.roomId || event.start == null || event.end == null) {
    return false;
  }

  const roomIds = booking.roomId.split(",").map((roomId) => roomId.trim());
  if (!roomIds.includes(String(event.resourceId))) return false;

  const bookingStart = booking.startDate?.toDate?.()?.getTime();
  const bookingEnd = booking.endDate?.toDate?.()?.getTime();
  if (!bookingStart || !bookingEnd) return false;

  const eventStart = new Date(event.start).getTime();
  const eventEnd = new Date(event.end).getTime();
  if (Number.isNaN(eventStart) || Number.isNaN(eventEnd)) return false;

  const FUZZ_MS = 60 * 1000;
  return (
    Math.abs(eventStart - bookingStart) < FUZZ_MS &&
    Math.abs(eventEnd - bookingEnd) < FUZZ_MS
  );
}

/**
 * Fallback when Google Calendar returns a different event id than Firestore
 * (guest copies on other room calendars). Same room+time is not enough on its
 * own — if the event belongs to a different booking in `allBookings`, it is a
 * real conflict and must not be ignored.
 */
export function isUnmatchedCopyOfBooking(
  event: EventLike,
  booking?: BookingSlotLike,
  allBookings: BookingSlotLike[] = [],
): boolean {
  if (!booking || !isSameSlotAsBooking(event, booking)) return false;

  const belongsToOtherBooking = allBookings.some((candidate) => {
    const candidateId = candidate.calendarEventId;
    if (!candidateId || candidateId === booking.calendarEventId) return false;
    return isOwnCalendarEvent(event, candidateId);
  });

  return !belongsToOtherBooking;
}
