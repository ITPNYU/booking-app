import { useContext, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

import { BookingContext } from "../bookingProvider";
import {
  parseBookingUrl,
  buildBookingUrl,
  getAffiliationStep,
} from "../utils/bookingUrlParser";

export default function useCheckFormMissingData() {
  const pathname = usePathname();
  const router = useRouter();

  const { role, department, selectedRooms, bookingCalendarInfo, formData } =
    useContext(BookingContext);

  useEffect(() => {
    const parsed = parseBookingUrl(pathname);
    if (!parsed || !parsed.step) return;

    const { tenant, flowType, step, id } = parsed;

    const hasAffiliationFields =
      (role && department) || flowType === "modification";
    const hasRoomSelectionFields =
      selectedRooms &&
      bookingCalendarInfo &&
      bookingCalendarInfo.startStr &&
      bookingCalendarInfo.endStr;

    // Check what's missing based on current step
    let isMissing = false;
    let redirectStep = "";

    if (step === "selectRoom" && !hasAffiliationFields) {
      isMissing = true;
      redirectStep = getAffiliationStep(flowType);
    } else if (step === "form" && !(hasAffiliationFields && hasRoomSelectionFields)) {
      isMissing = true;
      redirectStep = !hasAffiliationFields ? getAffiliationStep(flowType) : "selectRoom";
    } else if (step === "confirmation" && !(hasAffiliationFields && hasRoomSelectionFields && formData)) {
      isMissing = true;
      if (!hasAffiliationFields) {
        redirectStep = getAffiliationStep(flowType);
      } else if (!hasRoomSelectionFields) {
        redirectStep = "selectRoom";
      }
    }

    if (isMissing && redirectStep) {
      console.log("MISSING DATA - redirecting:", { pathname, flowType, step, id });
      router.push(buildBookingUrl(tenant, flowType, redirectStep, id));
    }
  }, [pathname, router, role, department, selectedRooms, bookingCalendarInfo, formData]);
}
