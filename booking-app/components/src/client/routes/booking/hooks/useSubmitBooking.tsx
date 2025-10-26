import { useCallback, useContext } from "react";
import { DEFAULT_TENANT } from "../../../../constants/tenants";
import {
  BookingOrigin,
  FormContextLevel,
  Inputs,
  PagePermission,
} from "../../../../types";

import { useParams, useRouter } from "next/navigation";
import { DatabaseContext } from "../../components/Provider";
import { BookingContext } from "../bookingProvider";
import useCalculateOverlap from "./useCalculateOverlap";
export default function useSubmitBooking(formContext: FormContextLevel) {
  const router = useRouter();
  const params = useParams();
  const tenant = (params?.tenant as string) || DEFAULT_TENANT;

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

      console.log(
        `🚀 SUBMIT BOOKING [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
        {
          tenant,
          isAutoApproval,
          formContext,
          isWalkIn,
          isVIP,
          isEdit,
          isModification,
          selectedRooms: selectedRooms?.map((r) => ({
            roomId: r.roomId,
            name: r.name,
            shouldAutoApprove: r.shouldAutoApprove,
          })),
          bookingDuration: bookingCalendarInfo
            ? `${((bookingCalendarInfo.end.getTime() - bookingCalendarInfo.start.getTime()) / (1000 * 60 * 60)).toFixed(1)} hours`
            : "Not set",
          formData: {
            title: data?.title,
            department,
            role,
            roomSetup: data?.roomSetup,
            mediaServices: data?.mediaServices,
            catering: data?.catering,
            hireSecurity: data?.hireSecurity,
          },
        }
      );

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
              endpoint: "/api/bookings/edit",
              method: "PUT",
              body: { calendarEventId, allRooms: roomSettings },
            };
          case FormContextLevel.MODIFICATION:
            return {
              endpoint: "/api/bookings/modification",
              method: "PUT",
              body: {
                calendarEventId,
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

      // Extract conditional fields to reduce duplication
      const modificationFields = (isEdit || isModification) && {
        modifiedBy: userEmail,
      };

      const requestBody = {
        origin: isVIP ? BookingOrigin.VIP : BookingOrigin.WALK_IN,
        type: isVIP ? BookingOrigin.VIP : BookingOrigin.WALK_IN,
        email,
        selectedRooms,
        bookingCalendarInfo,
        liaisonUsers,
        data,
        isAutoApproval,
        // Add modifiedBy as a top-level parameter for edit/modification context
        ...modificationFields,
        ...(requestParams.body ?? {}),
      };

      console.log(
        `📡 SENDING REQUEST [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
        {
          endpoint: requestParams.endpoint,
          method: requestParams.method,
          tenant,
          isAutoApproval,
          email,
          requestBody,
        }
      );

      fetch(`${process.env.NEXT_PUBLIC_BASE_URL}${requestParams.endpoint}`, {
        method: requestParams.method,
        headers: {
          "Content-Type": "application/json",
          "x-tenant": tenant,
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
          // Add modifiedBy as a top-level parameter for edit/modification context
          ...modificationFields,
          ...(requestParams.body ?? {}),
        }),
      })
        .then((res) => {
          console.log(
            `📨 API RESPONSE [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
            {
              status: res.status,
              statusText: res.statusText,
              endpoint: requestParams.endpoint,
              isAutoApproval,
            }
          );

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
