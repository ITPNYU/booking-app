import dayjs, { Dayjs } from "dayjs";
import { useContext, useMemo } from "react";
import { DatabaseContext } from "../../components/Provider";

export const useBookingDateRestrictions = () => {
  const { blackoutPeriods, roomSettings } = useContext(DatabaseContext);

  const activeBlackoutPeriods = useMemo(() => {
    if (!blackoutPeriods || !Array.isArray(blackoutPeriods)) {
      return [];
    }
    return blackoutPeriods.filter((period) => period.isActive);
  }, [blackoutPeriods]);

  const isDateDisabled = (date: Dayjs) => {
    // Always disable past dates
    if (date.isBefore(dayjs(), "day")) {
      return true;
    }

    // Check if date falls within any global blackout period (periods that apply to all rooms)
    return activeBlackoutPeriods.some((period) => {
      const startDate = dayjs(period.startDate.toDate());
      const endDate = dayjs(period.endDate.toDate());

      // Check if date is within this blackout period
      const isDateInPeriod =
        (date.isAfter(startDate, "day") || date.isSame(startDate, "day")) &&
        (date.isBefore(endDate, "day") || date.isSame(endDate, "day"));

      if (!isDateInPeriod) {
        return false;
      }

      // Check if this period applies to all available rooms
      if (roomSettings && roomSettings.length > 0 && period.roomIds) {
        const allRoomIds = roomSettings
          .map((room) => room.roomId)
          .sort((a, b) => a - b);
        const periodRoomIds = [...period.roomIds].sort((a, b) => a - b);
        const isAllRooms =
          allRoomIds.length === periodRoomIds.length &&
          allRoomIds.every((id, index) => id === periodRoomIds[index]);

        return isAllRooms;
      }

      // Fallback: if no roomSettings or no roomIds, disable globally
      return !period.roomIds;
    });
  };

  // Check if a specific date is disabled for specific rooms
  const isDateDisabledForRooms = (date: Dayjs, roomIds: number[]) => {
    // Always disable past dates
    if (date.isBefore(dayjs(), "day")) {
      return true;
    }

    // Check if date falls within any active blackout period that applies to the selected rooms
    return activeBlackoutPeriods.some((period) => {
      const startDate = dayjs(period.startDate.toDate());
      const endDate = dayjs(period.endDate.toDate());

      // Check if date is within this blackout period
      const isDateInPeriod =
        (date.isAfter(startDate, "day") || date.isSame(startDate, "day")) &&
        (date.isBefore(endDate, "day") || date.isSame(endDate, "day"));

      if (!isDateInPeriod) {
        return false;
      }

      // If period has roomIds, check if any of the selected rooms are in the blackout period
      if (period.roomIds) {
        return roomIds.some((roomId) => period.roomIds!.includes(roomId));
      }

      // If no roomIds, treat as global blackout that applies to all rooms
      return true;
    });
  };

  const getBlackoutPeriodForDate = (date: Dayjs) => {
    return activeBlackoutPeriods.find((period) => {
      const startDate = dayjs(period.startDate.toDate());
      const endDate = dayjs(period.endDate.toDate());
      return (
        (date.isAfter(startDate, "day") || date.isSame(startDate, "day")) &&
        (date.isBefore(endDate, "day") || date.isSame(endDate, "day"))
      );
    });
  };

  // Get blackout periods that apply to specific rooms for a specific date
  const getBlackoutPeriodsForDateAndRooms = (
    date: Dayjs,
    roomIds: number[]
  ) => {
    return activeBlackoutPeriods.filter((period) => {
      const startDate = dayjs(period.startDate.toDate());
      const endDate = dayjs(period.endDate.toDate());

      // Check if date is within this blackout period
      const isDateInPeriod =
        (date.isAfter(startDate, "day") || date.isSame(startDate, "day")) &&
        (date.isBefore(endDate, "day") || date.isSame(endDate, "day"));

      if (!isDateInPeriod) {
        return false;
      }

      // If period has roomIds, check if any of the selected rooms are in the blackout period
      if (period.roomIds) {
        return roomIds.some((roomId) => period.roomIds!.includes(roomId));
      }

      // Include global blackout periods (those without roomIds)
      return true;
    });
  };

  // Check if a specific booking time range overlaps with any blackout periods for given rooms
  const isBookingTimeInBlackout = (
    bookingStart: Dayjs,
    bookingEnd: Dayjs,
    roomIds: number[]
  ): { inBlackout: boolean; affectedPeriods: any[] } => {
    if (!roomIds || roomIds.length === 0) {
      return { inBlackout: false, affectedPeriods: [] };
    }

    const affectedPeriods: any[] = [];

    const hasBlackout = activeBlackoutPeriods.some((period) => {
      const startDate = dayjs(period.startDate.toDate());
      const endDate = dayjs(period.endDate.toDate());

      // Helper function to check if booking time overlaps with blackout period on a specific day
      const isTimeInBlackoutPeriod = (
        checkDate: Dayjs,
        dayBookingStart: Dayjs,
        dayBookingEnd: Dayjs
      ) => {
        // If no specific times are set, blackout applies to entire day
        if (!period.startTime || !period.endTime) {
          return true;
        }

        const isStartDate = checkDate.isSame(startDate, "day");
        const isEndDate = checkDate.isSame(endDate, "day");
        const isSameDay = startDate.isSame(endDate, "day");

        if (isSameDay) {
          // Single day blackout - use specified time range
          const [startHour, startMinute] = period.startTime
            .split(":")
            .map(Number);
          const [endHour, endMinute] = period.endTime.split(":").map(Number);

          const blackoutStart = checkDate
            .hour(startHour)
            .minute(startMinute)
            .second(0)
            .millisecond(0);
          const blackoutEnd = checkDate
            .hour(endHour)
            .minute(endMinute)
            .second(0)
            .millisecond(0);

          // Handle case where blackout end time is before start time (spans midnight)
          const actualBlackoutEnd = blackoutEnd.isBefore(blackoutStart)
            ? blackoutEnd.add(1, "day")
            : blackoutEnd;

          // Check if booking time overlaps with blackout time
          return (
            (dayBookingStart.isBefore(actualBlackoutEnd) &&
              dayBookingEnd.isAfter(blackoutStart)) ||
            dayBookingStart.isSame(blackoutStart) ||
            dayBookingEnd.isSame(actualBlackoutEnd)
          );
        } else {
          // Multi-day blackout period
          if (isStartDate) {
            // Start date: blackout from start time to end of day
            const [startHour, startMinute] = period.startTime
              .split(":")
              .map(Number);
            const blackoutStart = checkDate
              .hour(startHour)
              .minute(startMinute)
              .second(0)
              .millisecond(0);
            const blackoutEnd = checkDate.endOf("day");

            return (
              (dayBookingStart.isBefore(blackoutEnd) &&
                dayBookingEnd.isAfter(blackoutStart)) ||
              dayBookingStart.isSame(blackoutStart) ||
              dayBookingEnd.isSame(blackoutEnd)
            );
          } else if (isEndDate) {
            // End date: blackout from start of day to end time
            const [endHour, endMinute] = period.endTime.split(":").map(Number);
            const blackoutStart = checkDate.startOf("day");
            const blackoutEnd = checkDate
              .hour(endHour)
              .minute(endMinute)
              .second(0)
              .millisecond(0);

            return (
              (dayBookingStart.isBefore(blackoutEnd) &&
                dayBookingEnd.isAfter(blackoutStart)) ||
              dayBookingStart.isSame(blackoutStart) ||
              dayBookingEnd.isSame(blackoutEnd)
            );
          } else {
            // Middle day: blackout entire day
            return true;
          }
        }
      };

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

          // Check if the booking time on this day overlaps with blackout period
          if (
            isTimeInBlackoutPeriod(currentDate, dayBookingStart, dayBookingEnd)
          ) {
            // Check room restrictions
            if (!period.roomIds || period.roomIds.length === 0) {
              affectedPeriods.push(period);
              return true; // Global blackout applies to all rooms
            }

            // Check if any of the selected rooms are in the blackout period
            if (roomIds.some((roomId) => period.roomIds!.includes(roomId))) {
              affectedPeriods.push(period);
              return true;
            }
          }
        }

        currentDate = currentDate.add(1, "day");
      }

      return false;
    });

    return { inBlackout: hasBlackout, affectedPeriods };
  };

  // Get blackout periods that would affect a specific booking time range
  const getBlackoutPeriodsForBookingTime = (
    bookingStart: Dayjs,
    bookingEnd: Dayjs,
    roomIds: number[]
  ) => {
    const result = isBookingTimeInBlackout(bookingStart, bookingEnd, roomIds);
    return result.affectedPeriods;
  };

  const shouldDisableDate = (date: Date) => {
    return isDateDisabled(dayjs(date));
  };

  const shouldDisableDateForRooms = (date: Date, roomIds: number[]) => {
    return isDateDisabledForRooms(dayjs(date), roomIds);
  };

  return {
    blackoutPeriods: activeBlackoutPeriods,
    isDateDisabled,
    isDateDisabledForRooms,
    shouldDisableDate,
    shouldDisableDateForRooms,
    getBlackoutPeriodForDate,
    getBlackoutPeriodsForDateAndRooms,
    isBookingTimeInBlackout,
    getBlackoutPeriodsForBookingTime,
    hasRestrictions: activeBlackoutPeriods.length > 0,
  };
};
