import { Department, Role } from "@/components/src/types";

import { useContext } from "react";
import { BookingContext } from "../../booking/bookingProvider";
import { DatabaseContext } from "../../components/Provider";

export default function useExistingBooking() {
  const {
    setDepartment,
    setRole,
    setSelectedRooms,
    setBookingCalendarInfo,
    setFormData,
  } = useContext(BookingContext);
  const { allBookings, roomSettings } = useContext(DatabaseContext);

  const findBooking = (calendarEventId: string) =>
    allBookings.filter(
      (booking) => booking.calendarEventId === calendarEventId,
    )[0];

  const loadExistingBookingData = (calendarEventId: string) => {
    const booking = findBooking(calendarEventId);

    setDepartment(booking.department as Department);
    setRole(booking.role as Role);

    const roomIds = booking.roomId.split(", ").map((x) => Number(x));
    const rooms = roomSettings.filter((roomSetting) =>
      roomIds.includes(roomSetting.roomId),
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

    // Keep only form-relevant values in formData. Including full booking payload
    // (notably xstateData snapshots) makes watched form deep-comparisons expensive.
    const {
      xstateData,
      requestedAt,
      startDate,
      endDate,
      finalApprovedAt,
      finalApprovedBy,
      firstApprovedAt,
      firstApprovedBy,
      canceledAt,
      canceledBy,
      checkedInAt,
      checkedInBy,
      checkedOutAt,
      checkedOutBy,
      noShowedAt,
      noShowedBy,
      declinedAt,
      declinedBy,
      modifiedAt,
      modifiedBy,
      closedAt,
      closedBy,
      preBannedAt,
      preBannedBy,
      bannedAt,
      bannedBy,
      createdAt,
      updatedAt,
      ...formValues
    } = booking as any;

    setFormData(formValues);
  };

  return loadExistingBookingData;
}
