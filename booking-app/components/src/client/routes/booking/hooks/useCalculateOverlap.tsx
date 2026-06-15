import { useCallback, useContext } from "react";

import { usePathname } from "next/navigation";
import { BookingContext } from "../bookingProvider";

export default function useCalculateOverlap() {
  const { bookingCalendarInfo, existingCalendarEvents, selectedRooms } =
    useContext(BookingContext);
  const pathname = usePathname();
  const isOverlapping = useCallback(() => {
    if (bookingCalendarInfo == null) return false;

    // check if /edit or /modification path and pull calendarEventId if true
    const editMode =
      pathname.includes("/edit") || pathname.includes("/modification");
    let calendarEventId: string | undefined;
    if (editMode) {
      // Extract the last non-empty segment as the calendarEventId. This supports both
      // /edit/<id> and nested paths like /edit/form/<id> or /modification/form/<id>
      const segments = pathname.split("/").filter(Boolean);
      calendarEventId = segments[segments.length - 1];
    }

    const selectedRoomIds = selectedRooms.map((x) => x.roomId);
    return existingCalendarEvents
      .map((event) => {
        if (!selectedRoomIds.includes(Number(event.resourceId))) return false;
        // for edit/modification mode, don't overlap with existing booking
        if (
          calendarEventId &&
          (event.id === calendarEventId ||
            event.id.split(":")[0] === calendarEventId)
        )
          return false;

        const eventStart = new Date(event.start);
        const eventEnd = new Date(event.end);

        if (
          (eventStart >= bookingCalendarInfo.start &&
            eventStart < bookingCalendarInfo.end) ||
          (eventEnd > bookingCalendarInfo.start &&
            eventEnd <= bookingCalendarInfo.end) ||
          (eventStart <= bookingCalendarInfo.start &&
            eventEnd >= bookingCalendarInfo.end)
        ) {
          console.log("overlap", event, bookingCalendarInfo);
          return true;
        }
        return false;
      })
      .some((x) => x);
  }, [bookingCalendarInfo, existingCalendarEvents, selectedRooms, pathname]);

  return isOverlapping();
}
