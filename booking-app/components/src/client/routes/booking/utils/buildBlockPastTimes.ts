import { fromZonedTime, toZonedTime } from "date-fns-tz";
import { TIMEZONE } from "@/components/src/client/utils/date";
import { DEFAULT_START_HOUR } from "./getStartHour";

export interface BlockPastTimeEvent {
  start: string;
  end: string;
  id: string;
  resourceId: string;
  overlap: boolean;
  display: string;
  classNames: string[];
}

/**
 * Builds FullCalendar background events that block past time slots on today's
 * calendar. All date comparisons are performed in Eastern timezone so the
 * result is correct for users in any browser timezone.
 *
 * @param rooms      - Array of rooms (only roomId is used).
 * @param dateView   - The calendar date currently being viewed.
 * @param startHour  - Earliest visible slot, e.g. "09:00:00" (Eastern).
 * @param slotUnit   - Slot / snap duration in minutes (e.g. 15).
 * @param now        - Current moment in time (default: new Date()). Injected
 *                     as a parameter so unit tests can control the clock.
 */
export function buildBlockPastTimes(
  rooms: Array<{ roomId: number | string }>,
  dateView: Date,
  startHour: string | undefined,
  slotUnit: number,
  now: Date = new Date()
): BlockPastTimeEvent[] {
  // Convert both dates to Eastern so all comparisons use the same timezone.
  const easternNow = toZonedTime(now, TIMEZONE);
  const easternView = toZonedTime(new Date(dateView), TIMEZONE);

  // Only block past slots when the user is viewing today (Eastern date).
  const isViewingToday =
    easternView.getFullYear() === easternNow.getFullYear() &&
    easternView.getMonth() === easternNow.getMonth() &&
    easternView.getDate() === easternNow.getDate();

  if (!isViewingToday) {
    return [];
  }

  // Parse startHour ("HH:MM:SS") into hour/minute components.
  const [rawHour, rawMinute] = (startHour ?? DEFAULT_START_HOUR)
    .split(":")
    .map((s) => parseInt(s, 10));
  const startH = Number.isFinite(rawHour) ? rawHour : 9;
  const startM = Number.isFinite(rawMinute) ? rawMinute : 0;

  // Build the block-start moment: startHour on the viewed Eastern date, as UTC.
  // fromZonedTime() treats its first argument's year/month/day/hour/minute as
  // being in the given timezone and returns the corresponding UTC Date.
  const blockStart = fromZonedTime(
    new Date(
      easternView.getFullYear(),
      easternView.getMonth(),
      easternView.getDate(),
      startH,
      startM,
      0,
      0
    ),
    TIMEZONE
  );

  // Round current Eastern time UP to the next slot boundary.
  const minutes = easternNow.getMinutes();
  const remainder = minutes % slotUnit;
  const roundedEastern = new Date(easternNow);
  if (remainder === 0) {
    roundedEastern.setSeconds(0, 0);
  } else {
    const carry = slotUnit - remainder;
    const totalMinutes = minutes + carry;
    roundedEastern.setHours(
      easternNow.getHours() + Math.floor(totalMinutes / 60),
      totalMinutes % 60,
      0,
      0
    );
  }
  // Convert the rounded Eastern time back to a proper UTC Date.
  const blockEnd = fromZonedTime(roundedEastern, TIMEZONE);

  // Nothing to block if current rounded time is at or before the calendar start.
  if (blockEnd <= blockStart) {
    return [];
  }

  return rooms.map((room) => ({
    start: blockStart.toISOString(),
    end: blockEnd.toISOString(),
    id: `${room.roomId}bg`,
    resourceId: `${room.roomId}`,
    overlap: false,
    display: "background",
    classNames: ["disabled"],
  }));
}
