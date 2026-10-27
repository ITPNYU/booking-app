/**
 * Half-open overlap: an event that only touches a boundary is not a conflict.
 * Shared by the calendar UI and the Google Calendar conflict check.
 */
export function timesOverlap(
  eventStart: Date,
  eventEnd: Date,
  rangeStart: Date,
  rangeEnd: Date,
): boolean {
  return (
    (eventStart >= rangeStart && eventStart < rangeEnd) ||
    (eventEnd > rangeStart && eventEnd <= rangeEnd) ||
    (eventStart <= rangeStart && eventEnd >= rangeEnd)
  );
}
