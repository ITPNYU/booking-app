import { useContext, useEffect } from "react";
import { usePathname, useRouter, useParams } from "next/navigation";

import { BookingContext } from "../bookingProvider";

export default function useCheckFormMissingData() {
  const pathname = usePathname();
  const router = useRouter();
  const { tenant } = useParams();

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
      const segments = pathname.split("/");
      const base = segments[2];
      const id = segments[3] ?? "";
      console.log("MISSING ID", id, pathname);
      router.push(`/${tenant}/${base}/${id}`);
    }
  }, []);
}
