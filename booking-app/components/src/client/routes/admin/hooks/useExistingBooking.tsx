import { Department, Role } from "@/components/src/types";

import { BookingContext } from "../../booking/bookingProvider";
import { DatabaseContext } from "../../components/Provider";
import { useContext } from "react";

export default function useExistingBooking() {
  const {
    setDepartment,
    setRole,
    setSelectedRooms,
    setBookingCalendarInfo,
    setFormData,
  } = useContext(BookingContext);
  const { bookings, roomSettings } = useContext(DatabaseContext);

  const findBooking = (calendarEventId: string) =>
    bookings.filter(
      (booking) => booking.calendarEventId === calendarEventId
    )[0];

  const loadExistingBookingData = (calendarEventId: string) => {
    const booking = findBooking(calendarEventId);

    setDepartment(booking.department as Department);
    setRole(booking.role as Role);

    const roomIds = booking.roomId.split(", ").map((x) => Number(x));
    const rooms = roomSettings.filter((roomSetting) =>
      roomIds.includes(roomSetting.roomId)
    );
    setSelectedRooms(rooms);

    const start = booking.startDate.toDate();
    const end = booking.endDate.toDate();
    const startStr = start.toISOString();
    const endStr = end.toISOString();
    setBookingCalendarInfo({
      start,
      end,
      startStr,
      endStr,
      allDay: false,
      jsEvent: null,
      view: null,
    });

    setFormData({ ...booking });
  };

  return loadExistingBookingData;
}
