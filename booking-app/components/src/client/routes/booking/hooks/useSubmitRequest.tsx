import React, { useContext, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { SubmitHandler, UseFormHandleSubmit } from "react-hook-form";

import { FormContextLevel, Inputs } from "../../../../types";
import { getRequestOrigin } from "../../../../utils/serviceSections";
import { BookingContext } from "../bookingProvider";
import { buildBookingUrl } from "../utils/bookingUrlParser";
import useCheckAutoApproval from "./useCheckAutoApproval";
import useSubmitBooking from "./useSubmitBooking";

/**
 * Submits the request from whichever step carries the submit block and moves
 * on to the Confirmation page. Guards against double submission.
 */
export default function useSubmitRequest(
  formContext: FormContextLevel,
  calendarEventId?: string,
) {
  const router = useRouter();
  const { tenant } = useParams();
  const { bookingCalendarInfo, department, role, formData } =
    useContext(BookingContext);
  const registerEvent = useSubmitBooking(formContext);

  const { isWalkIn, isVIP, isMod } = getRequestOrigin(
    formContext,
    formData?.origin,
  );
  const { isAutoApproval } = useCheckAutoApproval(isWalkIn, isVIP, isMod);

  const [isSubmitting, setIsSubmitting] = useState(false);
  // Add a ref to track submission state to prevent race conditions
  const isSubmittingRef = useRef(false);

  const onSubmit: SubmitHandler<Inputs> = (data) => {
    // Prevent multiple submissions using ref
    if (isSubmittingRef.current || !bookingCalendarInfo) return;

    // Set both state and ref immediately
    setIsSubmitting(true);
    isSubmittingRef.current = true;

    console.log("📝 FORM SUBMISSION DATA:", {
      isVIP,
      isWalkIn,
      // Affiliation info
      department: data.department,
      otherDepartment: data.otherDepartment,
      school: data.school,
      otherSchool: data.otherSchool,
      role: data.role,
      // VIP/Walk-in specific
      netId: data.netId,
      // From context
      departmentFromContext: department,
      roleFromContext: role,
      // Form data context
      formDataDepartment: formData?.department,
      formDataOtherDepartment: formData?.otherDepartment,
      formDataSchool: formData?.school,
      formDataOtherSchool: formData?.otherSchool,
    });

    // An edit lands on the flow's confirmation page; there is no edit/confirmation.
    const confirmationFlow = isMod
      ? "modification"
      : isWalkIn
        ? "walk-in"
        : isVIP
          ? "vip"
          : "book";

    registerEvent(data, isAutoApproval, calendarEventId)
      .catch((error) => {
        console.error("Error submitting booking:", error);
      })
      .finally(() => {
        router.push(
          buildBookingUrl(String(tenant), confirmationFlow, "confirmation"),
        );
      });
  };

  /** Wrap a step's handleSubmit so a second click cannot submit twice. */
  const createSubmitHandler =
    (handleSubmit: UseFormHandleSubmit<Inputs>) =>
    (e: React.BaseSyntheticEvent) => {
      // If already submitting, prevent the default form submission
      if (isSubmittingRef.current) {
        e.preventDefault();
        return false;
      }

      // Otherwise, proceed with the normal form submission
      return handleSubmit(onSubmit)(e);
    };

  return { isSubmitting, createSubmitHandler };
}
