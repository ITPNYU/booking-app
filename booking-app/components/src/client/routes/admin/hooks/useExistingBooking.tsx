import { Department, Role } from "@/components/src/types";

import { BookingContext } from "../../../providers/BookingFormProvider";
import { InputsMediaCommons } from "@/components/src/typesMediaCommons";
import { SharedDatabaseContext } from "../../../providers/SharedDatabaseProvider";
import useBookings from "../../components/bookingTable/hooks/useBookings";
import { useContext } from "react";

export default function useExistingBooking() {
  const {
    setDepartment,
    setRole,
    setSelectedRooms,
    setBookingCalendarInfo,
    setFormData,
  } = useContext(BookingContext);
  const { resources } = useContext(SharedDatabaseContext);
  const bookings = useBookings();

  const findBooking = (calendarEventId: string) =>
    bookings.filter(
      (booking) => booking.calendarEventId === calendarEventId
    )[0];

  const loadExistingBookingData = (calendarEventId: string) => {
    const booking = findBooking(calendarEventId);

    if ("department" in booking) {
      setDepartment(booking.department as Department);
    }
    setRole(booking.role as Role);

    const roomIds = booking.roomId.split(", ").map((x) => Number(x));
    const rooms = resources.filter((resource) =>
      roomIds.includes(resource.roomId)
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

    setFormData({ ...booking } as unknown as InputsMediaCommons);
  };

  return loadExistingBookingData;
}
