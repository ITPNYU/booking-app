import { useContext, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

import { BookingContext } from "../../../providers/BookingFormProvider";
import { Tenants } from "@/components/src/policy";
import useTenant from "../../../utils/useTenant";

export default function useCheckFormMissingData() {
  const pathname = usePathname();
  const router = useRouter();
  const tenant = useTenant();

  const { role, department, selectedRooms, bookingCalendarInfo, formData } =
    useContext(BookingContext);

  const hasAffiliationFields =
    (role && department) || pathname.includes("/modification");

  const hasDate =
    bookingCalendarInfo &&
    bookingCalendarInfo.startStr &&
    bookingCalendarInfo.endStr;

  const hasRoomSelectionFields = selectedRooms && hasDate;

  const hasFormData = formData;

  useEffect(() => {
    let isMissing = false;
    if (tenant === Tenants.STAGING) {
      if (pathname.includes("/form")) {
        isMissing = !hasDate;
      } else if (pathname.includes("/confirmation")) {
        isMissing = !(hasDate && hasFormData);
      }
    } else if (pathname.includes("/selectRoom")) {
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
      const base = pathname.split("/")[1] + "/" + pathname.split("/")[2];
      const id = pathname.split("/")[4] ?? "";
      console.log("MISSING ID", id, pathname);
      router.push(`/${base}/${id}`);
    }
  }, [tenant]);
}
