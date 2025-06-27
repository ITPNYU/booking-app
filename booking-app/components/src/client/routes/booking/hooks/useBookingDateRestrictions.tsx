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

    // Check if date falls within any active blackout period
    return activeBlackoutPeriods.some((period) => {
      const startDate = dayjs(period.startDate.toDate());
      const endDate = dayjs(period.endDate.toDate());
      return (
        (date.isAfter(startDate, "day") || date.isSame(startDate, "day")) &&
        (date.isBefore(endDate, "day") || date.isSame(endDate, "day"))
      );
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

  const shouldDisableDate = (date: Date) => {
    return isDateDisabled(dayjs(date));
  };

  return {
    blackoutPeriods: activeBlackoutPeriods,
    isDateDisabled,
    shouldDisableDate,
    getBlackoutPeriodForDate,
    hasRestrictions: activeBlackoutPeriods.length > 0,
  };
};
