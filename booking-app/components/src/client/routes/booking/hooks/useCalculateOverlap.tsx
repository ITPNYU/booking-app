import { useCallback, useContext } from "react";

import { BookingContext } from "../bookingProvider";
import { usePathname } from "next/navigation";

export default function useCalculateOverlap() {
  const { bookingCalendarInfo, existingCalendarEvents, selectedRooms } =
    useContext(BookingContext);
  const pathname = usePathname();

  const isOverlapping = useCallback(() => {
    if (bookingCalendarInfo == null) return false;

    // check if /edit or /modification path and pull calendarEventId if true
    const match = pathname.match(
      /^\/(?:edit|modification)\/selectRoom\/([a-zA-Z0-9_-]+)$/
    );
    let calendarEventId: string;
    if (match) {
      calendarEventId = match[1];
    }

    const selectedRoomIds = selectedRooms.map((x) => x.roomId);
    return existingCalendarEvents
      .map((event) => {
        if (!selectedRoomIds.includes(Number(event.resourceId))) return false;
        // for edit mode, don't overlap with existing booking
        if (event.id.split(":")[0] === calendarEventId) return false;

        const eventStart = new Date(event.start);
        const eventEnd = new Date(event.end);
        return (
          (eventStart >= bookingCalendarInfo.start &&
            eventStart < bookingCalendarInfo.end) ||
          (eventEnd > bookingCalendarInfo.start &&
            eventEnd <= bookingCalendarInfo.end) ||
          (eventStart <= bookingCalendarInfo.start &&
            eventEnd >= bookingCalendarInfo.end)
        );
      })
      .some((x) => x);
  }, [bookingCalendarInfo, existingCalendarEvents, selectedRooms]);

  return isOverlapping();
}
