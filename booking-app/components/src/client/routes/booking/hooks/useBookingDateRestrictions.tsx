import dayjs, { Dayjs } from "dayjs";
import { useContext, useMemo } from "react";
import { DatabaseContext } from "../../components/Provider";

export const useBookingDateRestrictions = () => {
  const { blackoutPeriods } = useContext(DatabaseContext);

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

    // Check if date falls within any global blackout period (periods without specific roomIds)
    return activeBlackoutPeriods.some((period) => {
      // Only check periods that apply to all rooms (no specific roomIds)
      if (period.roomIds && period.roomIds.length > 0) {
        return false;
      }

      const startDate = dayjs(period.startDate.toDate());
      const endDate = dayjs(period.endDate.toDate());
      return (
        (date.isAfter(startDate, "day") || date.isSame(startDate, "day")) &&
        (date.isBefore(endDate, "day") || date.isSame(endDate, "day"))
      );
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

      // If period has no specific rooms (roomIds is undefined/empty), it applies to all rooms
      if (!period.roomIds || period.roomIds.length === 0) {
        return true;
      }

      // Check if any of the selected rooms are in the blackout period
      return roomIds.some((roomId) => period.roomIds!.includes(roomId));
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

      // If period has no specific rooms, it applies to all rooms
      if (!period.roomIds || period.roomIds.length === 0) {
        return true;
      }

      // Check if any of the selected rooms are in the blackout period
      return roomIds.some((roomId) => period.roomIds!.includes(roomId));
    });
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
    hasRestrictions: activeBlackoutPeriods.length > 0,
  };
};
