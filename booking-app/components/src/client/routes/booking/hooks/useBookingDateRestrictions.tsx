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

  const stringIdBlackoutPeriods = useMemo(
    () =>
      activeBlackoutPeriods.map((period) => ({
        ...period,
        roomIds: period.roomIds?.map(String),
      })),
    [activeBlackoutPeriods],
  );

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
          .sort((a, b) =>
            String(a).localeCompare(String(b), undefined, { numeric: true }),
          );
        const periodRoomIds = period.roomIds
          .map(String)
          .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
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
  const isDateDisabledForRooms = (date: Dayjs, roomIds: string[]) => {
    const normalizedRoomIds = roomIds.map(String);

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
        const periodRoomIds = period.roomIds.map(String);
        return normalizedRoomIds.some((roomId) =>
          periodRoomIds.includes(roomId),
        );
      }

      // If no roomIds, treat as global blackout that applies to all rooms
      return true;
    });
  };

  const getBlackoutPeriodForDate = (date: Dayjs) =>
    activeBlackoutPeriods.find((period) => {
      const blackoutRange = getBlackoutTimeRangeForDate(period, date);
      return blackoutRange !== null;
    });

  // Get blackout periods that apply to specific rooms for a specific date
  const getBlackoutPeriodsForDateAndRooms = (date: Dayjs, roomIds: string[]) =>
    activeBlackoutPeriods.filter((period) => {
      const normalizedRoomIds = roomIds.map(String);
      const blackoutRange = getBlackoutTimeRangeForDate(period, date);
      if (!blackoutRange) {
        return false; // Date not in blackout period
      }

      // If period has roomIds, check if any of the selected rooms are in the blackout period
      if (period.roomIds) {
        const periodRoomIds = period.roomIds.map(String);
        return normalizedRoomIds.some((roomId) =>
          periodRoomIds.includes(roomId),
        );
      }

      // Include global blackout periods (those without roomIds)
      return true;
    });

  // Check if a specific booking time range overlaps with any blackout periods for given rooms
  const isBookingTimeInBlackout = (
    bookingStart: Dayjs,
    bookingEnd: Dayjs,
    roomIds: string[],
  ): { inBlackout: boolean; affectedPeriods: any[] } => {
    if (!roomIds || roomIds.length === 0) {
      return { inBlackout: false, affectedPeriods: [] };
    }

    const affectedPeriods = getAffectingBlackoutPeriods(
      stringIdBlackoutPeriods,
      bookingStart,
      bookingEnd,
      roomIds.map(String),
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
    roomIds: string[],
  ) =>
    getAffectingBlackoutPeriods(
      stringIdBlackoutPeriods,
      bookingStart,
      bookingEnd,
      roomIds.map(String),
    );

  const shouldDisableDate = (date: Dayjs) => isDateDisabled(date);
  const shouldDisableDateForRooms = (date: Dayjs, roomIds: string[]) =>
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
