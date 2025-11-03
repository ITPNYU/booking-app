import { useContext, useEffect, useState } from "react";
import { useTenantSchema } from "../../components/SchemaProvider";
import { BookingContext } from "../bookingProvider";
import { Role } from "../../../../types";
import { getBookingHourLimits } from "../utils/bookingHourLimits";

interface DurationLimitError {
  roomId: number;
  roomName: string;
  currentDuration: number;
  maxDuration: number;
  minDuration: number;
  role: Role;
  isWalkIn: boolean;
  errorType: "max" | "min";
}

export default function useCheckDurationLimits(isWalkIn = false, isVIP = false) {
  const { bookingCalendarInfo, selectedRooms, role } = useContext(BookingContext);
  const schema = useTenantSchema();

  const [durationError, setDurationError] = useState<DurationLimitError | null>(null);

  useEffect(() => {
    // Reset error state
    setDurationError(null);

    // Check duration limits based on resource maxHour and minHour
    if (bookingCalendarInfo != null && selectedRooms.length > 0) {
      const startDate = bookingCalendarInfo.start;
      const endDate = bookingCalendarInfo.end;
      const duration = endDate.getTime() - startDate.getTime();
      const durationHours = duration / (1000 * 60 * 60);

      // Get the hour limits based on role and selected rooms
      const { maxHours, minHours } = getBookingHourLimits(selectedRooms, role, isWalkIn, isVIP);

      // Check maximum duration
      if (durationHours > maxHours) {
        setDurationError({
          roomId: selectedRooms[0].roomId,
          roomName: selectedRooms[0].name,
          currentDuration: durationHours,
          maxDuration: maxHours,
          minDuration: minHours,
          role: role || Role.STUDENT,
          isWalkIn,
          errorType: "max"
        });
        return;
      }

      // Check minimum duration
      if (durationHours < minHours) {
        setDurationError({
          roomId: selectedRooms[0].roomId,
          roomName: selectedRooms[0].name,
          currentDuration: durationHours,
          maxDuration: maxHours,
          minDuration: minHours,
          role: role || Role.STUDENT,
          isWalkIn,
          errorType: "min"
        });
        return;
      }
    }
  }, [bookingCalendarInfo, selectedRooms, role, schema.resources, isWalkIn, isVIP]);

  return { durationError };
}
