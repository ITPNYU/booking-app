import { useContext, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

import { BookingContext } from "../bookingProvider";

export default function useCheckFormMissingData() {
  const pathname = usePathname();
  const router = useRouter();

  const { role, department, selectedRooms, bookingCalendarInfo, formData } =
    useContext(BookingContext);

  const hasAffiliationFields = role && department;
  const hasRoomSelectionFields =
    selectedRooms &&
    bookingCalendarInfo &&
    bookingCalendarInfo.startStr &&
    bookingCalendarInfo.endStr;

  const hasFormData = formData;

  useEffect(() => {
    let isMissing = false;
    if (pathname.includes("/selectRoom")) {
      isMissing = !hasAffiliationFields;
    } else if (pathname.includes("/form")) {
      isMissing = !(hasAffiliationFields && hasRoomSelectionFields);
    } else if (pathname.includes("/confirmation")) {
      isMissing = !(
        hasAffiliationFields &&
        hasRoomSelectionFields &&
        hasFormData
      );
    }

    if (isMissing) {
      router.push("/" + pathname.split("/")[1]);
    }
  }, []);
}
