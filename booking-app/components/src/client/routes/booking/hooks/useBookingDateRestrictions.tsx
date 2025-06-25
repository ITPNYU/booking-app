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

      // Fallback: if no roomSettings or no roomIds, don't disable globally
      return false;
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

      // Since all periods now have roomIds, check if any of the selected rooms are in the blackout period
      if (period.roomIds) {
        return roomIds.some((roomId) => period.roomIds!.includes(roomId));
      }

      return false;
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

      // Since all periods now have roomIds, check if any of the selected rooms are in the blackout period
      if (period.roomIds) {
        return roomIds.some((roomId) => period.roomIds!.includes(roomId));
      }

      return false;
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
