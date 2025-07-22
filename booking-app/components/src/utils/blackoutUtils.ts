import dayjs, { Dayjs } from "dayjs";
import { BlackoutPeriod } from "../types";

/**
 * Utility functions for blackout period time calculations
 */

export interface BlackoutTimeRange {
  start: Dayjs;
  end: Dayjs;
  title: string;
}

/**
 * Calculate the blackout time range for a specific date within a blackout period
 */
export function getBlackoutTimeRangeForDate(
  period: BlackoutPeriod,
  checkDate: Dayjs
): BlackoutTimeRange | null {
  const startDate = dayjs(period.startDate.toDate());
  const endDate = dayjs(period.endDate.toDate());

  // Check if the date is within the blackout period
  const isDateInPeriod =
    !checkDate.isBefore(startDate, "day") && !checkDate.isAfter(endDate, "day");

  if (!isDateInPeriod) {
    return null;
  }

  const isStartDate = checkDate.isSame(startDate, "day");
  const isEndDate = checkDate.isSame(endDate, "day");
  const isSameDay = startDate.isSame(endDate, "day");

  // If no specific times are set, blackout applies to entire day
  if (!period.startTime || !period.endTime) {
    return {
      start: checkDate.startOf("day"),
      end: checkDate.endOf("day"),
      title: `🚫 ${period.name}`,
    };
  }

  if (isSameDay) {
    // Single day blackout - use specified time range
    const [startHour, startMinute] = period.startTime.split(":").map(Number);
    const [endHour, endMinute] = period.endTime.split(":").map(Number);

    let blackoutStart = checkDate
      .hour(startHour)
      .minute(startMinute)
      .second(0)
      .millisecond(0);
    let blackoutEnd = checkDate
      .hour(endHour)
      .minute(endMinute)
      .second(0)
      .millisecond(0);

    // Handle case where blackout end time is before start time (spans midnight)
    if (blackoutEnd.isBefore(blackoutStart)) {
      blackoutEnd = blackoutEnd.add(1, "day");
    }

    return {
      start: blackoutStart,
      end: blackoutEnd,
      title: `🚫 ${period.name} (${period.startTime}-${period.endTime})`,
    };
  } else {
    // Multi-day blackout period
    if (isStartDate) {
      // Start date: blackout from start time to end of day
      const [startHour, startMinute] = period.startTime.split(":").map(Number);
      const blackoutStart = checkDate
        .hour(startHour)
        .minute(startMinute)
        .second(0)
        .millisecond(0);
      const blackoutEnd = checkDate.endOf("day");

      return {
        start: blackoutStart,
        end: blackoutEnd,
        title: `🚫 ${period.name} (${period.startTime}→)`,
      };
    } else if (isEndDate) {
      // End date: blackout from start of day to end time
      const [endHour, endMinute] = period.endTime.split(":").map(Number);
      const blackoutStart = checkDate.startOf("day");
      const blackoutEnd = checkDate
        .hour(endHour)
        .minute(endMinute)
        .second(0)
        .millisecond(0);

      return {
        start: blackoutStart,
        end: blackoutEnd,
        title: `🚫 ${period.name}`,
      };
    } else {
      // Middle day: blackout entire day
      return {
        start: checkDate.startOf("day"),
        end: checkDate.endOf("day"),
        title: `🚫 ${period.name} (all day)`,
      };
    }
  }
}

/**
 * Check if two time ranges overlap
 */
export function doTimeRangesOverlap(
  range1Start: Dayjs,
  range1End: Dayjs,
  range2Start: Dayjs,
  range2End: Dayjs
): boolean {
  return (
    (range1Start.isBefore(range2End) && range1End.isAfter(range2Start)) ||
    range1Start.isSame(range2Start) ||
    range1End.isSame(range2End)
  );
}

/**
 * Check if a booking time overlaps with a blackout period
 */
export function isBookingInBlackoutPeriod(
  period: BlackoutPeriod,
  bookingStart: Dayjs,
  bookingEnd: Dayjs,
  selectedRoomIds: number[]
): boolean {
  const startDate = dayjs(period.startDate.toDate());
  const endDate = dayjs(period.endDate.toDate());

  // Check room restrictions first
  if (period.roomIds && period.roomIds.length > 0) {
    const hasRoomOverlap = selectedRoomIds.some((roomId) =>
      period.roomIds!.includes(roomId)
    );
    if (!hasRoomOverlap) {
      return false; // No room overlap, booking is not affected
    }
  }

  // Check each day of the blackout period
  let currentDate = startDate.startOf("day");
  const endDateEndOfDay = endDate.endOf("day");

  while (
    currentDate.isBefore(endDateEndOfDay, "day") ||
    currentDate.isSame(endDateEndOfDay, "day")
  ) {
    // Check if booking date matches current blackout date
    const bookingStartDay = bookingStart.startOf("day");
    const bookingEndDay = bookingEnd.startOf("day");

    const isBookingOnThisDay =
      bookingStartDay.isSame(currentDate, "day") ||
      bookingEndDay.isSame(currentDate, "day") ||
      (bookingStartDay.isBefore(currentDate, "day") &&
        bookingEndDay.isAfter(currentDate, "day"));

    if (isBookingOnThisDay) {
      // Get the booking times for this specific day
      let dayBookingStart = bookingStart;
      let dayBookingEnd = bookingEnd;

      // If booking spans multiple days, adjust times for this specific day
      if (!bookingStart.isSame(currentDate, "day")) {
        dayBookingStart = currentDate.startOf("day");
      }
      if (!bookingEnd.isSame(currentDate, "day")) {
        dayBookingEnd = currentDate.endOf("day");
      }

      // Get blackout time range for this day
      const blackoutRange = getBlackoutTimeRangeForDate(period, currentDate);
      if (blackoutRange) {
        // Check if booking time overlaps with blackout time
        if (
          doTimeRangesOverlap(
            dayBookingStart,
            dayBookingEnd,
            blackoutRange.start,
            blackoutRange.end
          )
        ) {
          return true;
        }
      }
    }

    currentDate = currentDate.add(1, "day");
  }

  return false;
}

/**
 * Get all blackout periods that affect a booking
 */
export function getAffectingBlackoutPeriods(
  blackoutPeriods: BlackoutPeriod[],
  bookingStart: Dayjs,
  bookingEnd: Dayjs,
  selectedRoomIds: number[]
): BlackoutPeriod[] {
  const activeBlackoutPeriods = blackoutPeriods.filter(
    (period) => period.isActive
  );

  return activeBlackoutPeriods.filter((period) =>
    isBookingInBlackoutPeriod(period, bookingStart, bookingEnd, selectedRoomIds)
  );
}
