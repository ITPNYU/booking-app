import { useContext } from "react";
import { BookingContext } from "../bookingProvider";
import { DatabaseContext } from "../../components/Provider";

export default function useHandleStartBooking() {
  const { reloadSafetyTrainedUsers } = useContext(DatabaseContext);
  const {
    reloadExistingCalendarEvents,
    setHasShownMocapModal,
    setDepartment,
    setRole,
    setSelectedRooms,
    setBookingCalendarInfo,
    setFormData,
  } = useContext(BookingContext);

  const handleStartBooking = () => {
    reloadSafetyTrainedUsers();
    reloadExistingCalendarEvents();

    // clear any selections from previous booking
    setDepartment(undefined);
    setRole(undefined);
    setSelectedRooms([]);
    setBookingCalendarInfo(undefined);
    setFormData(undefined);

    setHasShownMocapModal(false);
  };

  return handleStartBooking;
}
