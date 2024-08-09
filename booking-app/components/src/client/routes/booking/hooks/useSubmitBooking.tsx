import { useCallback, useContext } from "react";

import { BookingContext } from "../bookingProvider";
import { DatabaseContext } from "../../components/Provider";
import { Inputs } from "../../../../types";
import useCheckAutoApproval from "./useCheckAutoApproval";
import { useRouter } from "next/navigation";

export default function useSubmitBooking(isWalkIn: boolean) {
  const router = useRouter();
  const { liaisonUsers, userEmail, reloadBookings, reloadBookingStatuses } =
    useContext(DatabaseContext);
  const { isAutoApproval } = useCheckAutoApproval();
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
  } = useContext(BookingContext);

  const registerEvent = useCallback(
    async (data: Inputs) => {
      if (!department || !role) {
        console.error("Missing info for submitting booking");
        return;
      }

      let email: string;
      setSubmitting("submitting");
      if (isWalkIn && data.netId) {
        email = data.netId + "@nyu.edu";
      } else {
        email = userEmail || data.missingEmail;
      }

      if (
        !bookingCalendarInfo ||
        !bookingCalendarInfo.startStr ||
        !bookingCalendarInfo.endStr
      ) {
        setSubmitting("error");
        return;
      }

      try {
        const endpoint = isWalkIn ? "/api/walkIn" : "/api/bookings";
        await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}${endpoint}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email,
            selectedRooms,
            bookingCalendarInfo,
            liaisonUsers,
            data,
            isAutoApproval,
          }),
        });

        // clear stored booking data after submit confirmation
        setBookingCalendarInfo(undefined);
        setSelectedRooms([]);
        setFormData(undefined);
        setHasShownMocapModal(false);

        reloadBookings();
        reloadBookingStatuses();
        setSubmitting("success");
      } catch (error) {
        console.error("Error submitting booking:", error);
        setSubmitting("error");
      }
    },
    [
      bookingCalendarInfo,
      selectedRooms,
      liaisonUsers,
      userEmail,
      router,
      reloadBookings,
      reloadBookingStatuses,
      department,
      role,
    ]
  );

  return registerEvent;
}
