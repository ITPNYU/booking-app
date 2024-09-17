import { useCallback, useContext } from "react";

import { BookingContext } from "../bookingProvider";
import { DatabaseContext } from "../../components/Provider";
import { Inputs } from "../../../../types";
import { useRouter } from "next/navigation";

export default function useSubmitBooking(isEdit: boolean, isWalkIn: boolean) {
  const router = useRouter();
  const { liaisonUsers, userEmail, reloadBookings, reloadBookingStatuses } =
    useContext(DatabaseContext);
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
    async (data: Inputs, isAutoApproval: boolean, calendarEventId?: string) => {
      if (
        !department ||
        !role ||
        selectedRooms.length === 0 ||
        !bookingCalendarInfo
      ) {
        console.error("Missing info for submitting booking");
        setSubmitting("error");
        return;
      }

      if (isEdit && data.netId) {
        // block another person editing someone's booking
        // TODO unless is PA or admin editing
        if (data.netId + "@nyu.edu" !== userEmail) {
          setSubmitting("error");
          return;
        }
      }

      let email: string;
      setSubmitting("submitting");
      if (isWalkIn && data.netId) {
        email = data.netId + "@nyu.edu";
      } else {
        email = userEmail || data.missingEmail;
      }

      const endpoint = isWalkIn ? "/api/walkIn" : "/api/bookings";
      fetch(`${process.env.NEXT_PUBLIC_BASE_URL}${endpoint}`, {
        method: isWalkIn || !isEdit ? "POST" : "PUT",
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
          ...(isEdit && calendarEventId && { calendarEventId }),
        }),
      })
        .then((res) => {
          // clear stored booking data after submit confirmation
          setBookingCalendarInfo(undefined);
          setSelectedRooms([]);
          setFormData(undefined);
          setHasShownMocapModal(false);

          reloadBookings();
          reloadBookingStatuses();
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
      reloadBookings,
      reloadBookingStatuses,
      department,
      role,
    ]
  );

  return registerEvent;
}
