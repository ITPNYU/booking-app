type EventLike = {
  id?: string;
  calendarEventId?: string;
  start?: string | Date;
  end?: string | Date;
  resourceId?: string | number;
  extendedProps?: { calendarEventId?: string };
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
 *
 * Guest copies on other room calendars get a different Google event id;
 * `/api/calendarEvents` stamps the Firestore booking id onto those events so
 * this check works without consulting DatabaseContext.allBookings.
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
