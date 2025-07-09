import dayjs, { Dayjs } from "dayjs";
import { useContext, useMemo } from "react";
import {
  getAffectingBlackoutPeriods,
  getBlackoutTimeRangeForDate,
} from "../../../../utils/blackoutUtils";
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
      const blackoutRange = getBlackoutTimeRangeForDate(period, date);
      if (!blackoutRange) {
        return false; // Date not in blackout period
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
      const blackoutRange = getBlackoutTimeRangeForDate(period, date);
      if (!blackoutRange) {
        return false; // Date not in blackout period
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
      const blackoutRange = getBlackoutTimeRangeForDate(period, date);
      return blackoutRange !== null;
    });
  };

  // Get blackout periods that apply to specific rooms for a specific date
  const getBlackoutPeriodsForDateAndRooms = (
    date: Dayjs,
    roomIds: number[]
  ) => {
    return activeBlackoutPeriods.filter((period) => {
      const blackoutRange = getBlackoutTimeRangeForDate(period, date);
      if (!blackoutRange) {
        return false; // Date not in blackout period
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

    const affectedPeriods = getAffectingBlackoutPeriods(
      activeBlackoutPeriods,
      bookingStart,
      bookingEnd,
      roomIds
    );

    return {
      inBlackout: affectedPeriods.length > 0,
      affectedPeriods,
    };
  };

  // Get blackout periods that affect a specific booking time
  const getBlackoutPeriodsForBookingTime = (
    bookingStart: Dayjs,
    bookingEnd: Dayjs,
    roomIds: number[]
  ) => {
    return getAffectingBlackoutPeriods(
      activeBlackoutPeriods,
      bookingStart,
      bookingEnd,
      roomIds
    );
  };

  const shouldDisableDate = (date: Dayjs) => isDateDisabled(date);
  const shouldDisableDateForRooms = (date: Dayjs, roomIds: number[]) =>
    isDateDisabledForRooms(date, roomIds);

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
