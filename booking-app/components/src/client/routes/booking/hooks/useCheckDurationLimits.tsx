import { useContext, useEffect, useState } from "react";
import { useTenantSchema } from "../../components/SchemaProvider";
import { BookingContext } from "../bookingProvider";
import { Role } from "../../../../types";

interface DurationLimitError {
  roomId: number;
  roomName: string;
  currentDuration: number;
  maxDuration: number;
  role: Role;
}

export default function useCheckDurationLimits() {
  const { bookingCalendarInfo, selectedRooms, role } = useContext(BookingContext);
  const schema = useTenantSchema();

  const [durationError, setDurationError] = useState<DurationLimitError | null>(null);

  useEffect(() => {
    // Reset error state
    setDurationError(null);

    // Check duration limits based on resource maxHour
    if (bookingCalendarInfo != null && role && selectedRooms.length > 0) {
      const startDate = bookingCalendarInfo.start;
      const endDate = bookingCalendarInfo.end;
      const duration = endDate.getTime() - startDate.getTime();
      const durationHours = duration / (1000 * 60 * 60);

      // Check each selected room's duration limit
      for (const room of selectedRooms) {
        const resource = schema.resources.find((r) => r.roomId === room.roomId);
        if (resource?.maxHour) {
          let maxHours: number;
          switch (role) {
            case Role.STUDENT:
              maxHours = resource.maxHour.student;
              break;
            case Role.FACULTY:
              maxHours = resource.maxHour.faculty;
              break;
            case Role.ADMIN_STAFF:
            case Role.CHAIR_PROGRAM_DIRECTOR:
            case Role.RESIDENT_FELLOW:
              maxHours = resource.maxHour.admin;
              break;
            default:
              maxHours = resource.maxHour.admin;
          }

          if (durationHours > maxHours) {
            setDurationError({
              roomId: room.roomId,
              roomName: room.name,
              currentDuration: durationHours,
              maxDuration: maxHours,
              role,
            });
            return; // Return early on first error found
          }
        }
      }
    }
  }, [bookingCalendarInfo, selectedRooms, role, schema.resources]);

  return { durationError };
}
