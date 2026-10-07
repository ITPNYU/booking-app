import { useContext, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

import { BookingContext } from "../bookingProvider";
import {
  parseBookingUrl,
  buildBookingUrl,
  getAffiliationStep,
} from "../utils/bookingUrlParser";
import { flowTypeToFormContext } from "../utils/formSteps";
import useFormSteps from "./useFormSteps";

/**
 * Bounce a request that lands on a step it is not ready for to the earliest
 * incomplete step: affiliation, then Select Time, then Details. The Services
 * step additionally needs a valid Details answer set and at least one
 * service section to show; otherwise it is skipped and Details keeps Submit.
 */
export default function useCheckFormMissingData() {
  const pathname = usePathname();
  const router = useRouter();

  const {
    role,
    department,
    selectedRooms,
    bookingCalendarInfo,
    formData,
    isDetailsValid,
    submitting,
  } = useContext(BookingContext);

  const parsed = parseBookingUrl(pathname);
  const { hasServicesStep } = useFormSteps(
    flowTypeToFormContext(parsed.flowType),
  );

  useEffect(() => {
    // Don't redirect while a booking is being submitted or was just submitted.
    // The submission flow clears context state (rooms, calendar info) on success,
    // which would otherwise trigger a false redirect back to an earlier step.
    if (submitting === "submitting" || submitting === "success") return;

    if (!parsed || !parsed.step) return;

    const { tenant, flowType, step, id } = parsed;

    const hasAffiliationFields =
      (role && department) || flowType === "modification";
    const hasRoomSelectionFields =
      selectedRooms &&
      bookingCalendarInfo &&
      bookingCalendarInfo.startStr &&
      bookingCalendarInfo.endStr;

    const earliestIncompleteStep = (): string => {
      if (!hasAffiliationFields) return getAffiliationStep(flowType);
      if (!hasRoomSelectionFields) return "selectRoom";
      return "";
    };

    // Check what's missing based on current step
    let isMissing = false;
    let redirectStep = "";

    if (step === "selectRoom" && !hasAffiliationFields) {
      isMissing = true;
      redirectStep = getAffiliationStep(flowType);
    } else if (
      step === "form" &&
      !(hasAffiliationFields && hasRoomSelectionFields)
    ) {
      isMissing = true;
      redirectStep = earliestIncompleteStep();
    } else if (step === "services") {
      const ready =
        hasAffiliationFields &&
        hasRoomSelectionFields &&
        isDetailsValid &&
        hasServicesStep;
      if (!ready) {
        isMissing = true;
        redirectStep = earliestIncompleteStep() || "form";
      }
    } else if (
      step === "confirmation" &&
      !(hasAffiliationFields && hasRoomSelectionFields && formData)
    ) {
      isMissing = true;
      redirectStep = earliestIncompleteStep();
    }

    if (isMissing && redirectStep) {
      console.log("MISSING DATA - redirecting:", {
        pathname,
        flowType,
        step,
        id,
      });
      router.push(buildBookingUrl(tenant, flowType, redirectStep, id));
    }
    // `parsed` is derived from pathname, which is already a dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    pathname,
    router,
    role,
    department,
    selectedRooms,
    bookingCalendarInfo,
    formData,
    isDetailsValid,
    hasServicesStep,
    submitting,
  ]);
}
