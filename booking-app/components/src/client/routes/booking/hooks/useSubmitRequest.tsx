import React, { useContext, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { SubmitHandler, UseFormHandleSubmit } from "react-hook-form";

import { FormContextLevel, Inputs } from "../../../../types";
import { getRequestOrigin } from "../../../../utils/serviceSections";
import { BookingContext } from "../bookingProvider";
import { claimDashboardReturn } from "../../components/bookingTable/dashboardView";
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

  const { isWalkIn, isVIP, isMod, isEdit } = getRequestOrigin(
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

    // A declined VIP booking is edited under the EDIT context, but it is still
    // a VIP request, so it confirms on the VIP page. Other edits use /edit,
    // where View Bookings can return to the dashboard the edit started from.
    const confirmationFlow = isMod
      ? "modification"
      : isWalkIn
        ? "walk-in"
        : isVIP
          ? "vip"
          : isEdit
            ? "edit"
            : "book";

    const tenantId = String(tenant ?? "");
    registerEvent(data, isAutoApproval, calendarEventId)
      .catch((error) => {
        console.error("Error submitting booking:", error);
        return "error" as const;
      })
      .then((outcome) => {
        // A staff modification goes back to the dashboard it came from.
        // Other requests still land on the confirmation page; an edit's
        // claimed return is read there by View Bookings.
        if (outcome === "success" && isEdit) {
          claimDashboardReturn("edit", tenantId, calendarEventId);
        }
        // Only a modification that started from a dashboard skips confirmation.
        // A modification opened some other way still shows the confirmation page.
        const modificationReturn =
          outcome === "success" && isMod
            ? claimDashboardReturn("modification", tenantId, calendarEventId)
            : null;
        if (outcome === "success" && isMod && modificationReturn != null) {
          router.replace(modificationReturn);
          return;
        }
        router.push(
          buildBookingUrl(tenantId, confirmationFlow, "confirmation"),
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
