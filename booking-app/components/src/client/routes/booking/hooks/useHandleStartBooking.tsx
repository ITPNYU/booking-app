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
    setIsDetailsValid,
    resetServiceRuleMemory,
    setCheckedAgreements,
    setAnnexByRoom,
  } = useContext(BookingContext);

  const handleStartBooking = () => {
    reloadSafetyTrainedUsers();
    reloadExistingCalendarEvents();

    // clear any selections from previous booking
    setDepartment(undefined);
    setRole(undefined);
    setSelectedRooms([]);
    setAnnexByRoom({});
    setBookingCalendarInfo(undefined);
    setFormData(undefined);
    setIsDetailsValid(false);
    resetServiceRuleMemory();
    setCheckedAgreements({});

    setHasShownMocapModal(false);
  };

  return handleStartBooking;
}
