import { useContext, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

import { BookingContext } from "../bookingProvider";

export default function useCheckFormMissingData() {
  const pathname = usePathname();
  const router = useRouter();

  const { role, department, selectedRooms, bookingCalendarInfo, formData } =
    useContext(BookingContext);

  const hasAffiliationFields =
    (role && department) || pathname.includes("/modification");
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
      const base = pathname.split("/")[1];
      const id = pathname.split("/")[3] ?? "";
      console.log("MISSING ID", id, pathname);
      router.push(`/${base}/${id}`);
    }
  }, []);
}
