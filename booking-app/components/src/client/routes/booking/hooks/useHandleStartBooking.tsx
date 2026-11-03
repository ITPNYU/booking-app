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
    setServiceDecisions,
    setViewDate,
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
    setServiceDecisions({});
    // viewDate lives in BookingProvider (so the calendar fetch window follows
    // it) and the provider stays mounted across client-side navigation, so a
    // month browsed during a previous booking would otherwise leak into the
    // next one.
    setViewDate(new Date());

    setHasShownMocapModal(false);
  };

  return handleStartBooking;
}
