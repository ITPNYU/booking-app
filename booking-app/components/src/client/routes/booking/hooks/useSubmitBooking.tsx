import { useCallback, useContext } from "react";
import {
  BookingOrigin,
  FormContextLevel,
  Inputs,
  PagePermission,
} from "../../../../types";

import { useRouter } from "next/navigation";
import { DatabaseContext } from "../../components/Provider";
import { BookingContext } from "../bookingProvider";
import useCalculateOverlap from "./useCalculateOverlap";
export default function useSubmitBooking(formContext: FormContextLevel) {
  const router = useRouter();
  const {
    liaisonUsers,
    userEmail,
    reloadFutureBookings,
    pagePermission,
    roomSettings,
  } = useContext(DatabaseContext);
  const {
    bookingCalendarInfo,
    department,
    role,
    selectedRooms,
    setBookingCalendarInfo,
    setSelectedRooms,
    setFormData,
    setHasShownMocapModal,
    setSubmitting,
    error,
    setError,
    isBanned,
    needsSafetyTraining,
    isInBlackoutPeriod,
  } = useContext(BookingContext);

  const isOverlap = useCalculateOverlap();
  if (isOverlap) {
    setError(new Error("Booking time slot is no longer available"));
    setSubmitting("error");
    return;
  }
  const isEdit = formContext === FormContextLevel.EDIT;
  const isWalkIn = formContext === FormContextLevel.WALK_IN;
  const isVIP = formContext === FormContextLevel.VIP;
  const isModification = formContext === FormContextLevel.MODIFICATION;

  const registerEvent = useCallback(
    async (data: Inputs, isAutoApproval: boolean, calendarEventId?: string) => {
      const hasAffiliation = (role && department) || isModification;
      if (
        !hasAffiliation ||
        selectedRooms.length === 0 ||
        !bookingCalendarInfo
      ) {
        console.error("Missing info for submitting booking");
        setSubmitting("error");
        return;
      }

      // Check for blocking conditions
      if (isBanned) {
        setError(new Error("You are banned from booking"));
        setSubmitting("error");
        return;
      }

      if (needsSafetyTraining) {
        setError(new Error("Safety training is required"));
        setSubmitting("error");
        return;
      }

      if (isInBlackoutPeriod) {
        setError(new Error("Selected date is within a blackout period"));
        setSubmitting("error");
        return;
      }

      if (isEdit && data.netId) {
        // block another person editing someone's booking
        if (data.netId + "@nyu.edu" !== userEmail) {
          setSubmitting("error");
          return;
        }
      }

      if (isModification && pagePermission === PagePermission.BOOKING) {
        // only a PA/admin can do a modification
        setSubmitting("error");
        return;
      }

      let email: string;
      setSubmitting("submitting");
      if ((isWalkIn || isModification || isVIP) && data.netId) {
        email = data.netId + "@nyu.edu";
      } else {
        email = userEmail || data.missingEmail;
      }

      const requestParams = ((): {
        endpoint: string;
        method: "POST" | "PUT";
        body?: Object;
      } => {
        switch (formContext) {
          case FormContextLevel.EDIT:
            return {
              endpoint: "/api/bookings",
              method: "PUT",
              body: { calendarEventId, allRooms: roomSettings },
            };
          case FormContextLevel.MODIFICATION:
            return {
              endpoint: "/api/bookings",
              method: "PUT",
              body: {
                calendarEventId,
                isAutoApproval: true,
                allRooms: roomSettings,
              },
            };
          case FormContextLevel.WALK_IN:
          case FormContextLevel.VIP:
            return {
              endpoint: "/api/bookingsDirect",
              method: "POST",
              body: {
                requestedBy: userEmail,
              },
            };
          default:
            return {
              endpoint: "/api/bookings",
              method: "POST",
            };
        }
      })();

      fetch(`${process.env.NEXT_PUBLIC_BASE_URL}${requestParams.endpoint}`, {
        method: requestParams.method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          origin: isVIP ? BookingOrigin.VIP : BookingOrigin.WALK_IN,
          type: isVIP ? BookingOrigin.VIP : BookingOrigin.WALK_IN,
          email,
          selectedRooms,
          bookingCalendarInfo,
          liaisonUsers,
          data,
          isAutoApproval,
          // Add modifiedBy as a top-level parameter for modification context
          ...(isModification && { modifiedBy: userEmail }),
          ...(requestParams.body ?? {}),
        }),
      })
        .then((res) => {
          if (res.status === 409) {
            setError(new Error("Booking time slot is no longer available"));
            setSubmitting("error");
            return;
          }
          // clear stored booking data after submit confirmation
          setBookingCalendarInfo(undefined);
          setSelectedRooms([]);
          setFormData(undefined);
          setHasShownMocapModal(false);

          reloadFutureBookings();
          setSubmitting("success");
        })
        .catch((error) => {
          console.error("Error submitting booking:", error);
          setSubmitting("error");
        });
    },
    [
      bookingCalendarInfo,
      selectedRooms,
      liaisonUsers,
      userEmail,
      router,
      reloadFutureBookings,
      department,
      role,
    ]
  );

  return registerEvent;
}
