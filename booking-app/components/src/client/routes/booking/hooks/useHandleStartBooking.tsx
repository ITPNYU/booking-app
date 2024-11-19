import { BookingContext } from "../../../providers/BookingFormProvider";
import { SharedDatabaseContext } from "../../../providers/SharedDatabaseProvider";
import { Tenants } from "@/components/src/policy";
import { useContext } from "react";
import { useRouter } from "next/navigation";
import useTenant from "../../../utils/useTenant";

export default function useHandleStartBooking() {
  const { reloadSafetyTrainedUsers } = useContext(SharedDatabaseContext);
  const {
    reloadExistingCalendarEvents,
    setHasShownMocapModal,
    setDepartment,
    setRole,
    setSelectedRooms,
    setBookingCalendarInfo,
    setFormData,
  } = useContext(BookingContext);
  const router = useRouter();
  const tenant = useTenant();

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

    switch (tenant) {
      case Tenants.MEDIA_COMMONS:
        router.push("/media-commons/book");
        break;
      case Tenants.STAGING:
        router.push("/staging/book");
        break;
    }
  };

  return handleStartBooking;
}
