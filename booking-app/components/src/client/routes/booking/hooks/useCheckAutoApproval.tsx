import {
  INSTANT_APPROVAL_ROOMS,
  WALK_IN_CAN_BOOK_TWO,
} from "../../../../mediaCommonsPolicy";
import { useContext, useEffect, useState } from "react";

import { BookingContext } from "../bookingProvider";

export function selectedAutoApprovalRooms(selectedRoomIds: number[]) {
  if (selectedRoomIds.length < 2) return true;
  if (selectedRoomIds.length > 2) return false;
  if (
    WALK_IN_CAN_BOOK_TWO.includes(selectedRoomIds[0]) &&
    WALK_IN_CAN_BOOK_TWO.includes(selectedRoomIds[1])
  )
    return true;
  return false;
}

export default function useCheckAutoApproval(isWalkIn = false) {
  const { bookingCalendarInfo, selectedRooms, formData } =
    useContext(BookingContext);

  const [isAutoApproval, setIsAutoApproval] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const throwError = (msg: string) => {
    setIsAutoApproval(false);
    setErrorMessage(msg);
  };

  useEffect(() => {
    // EVENT DURATION > 4 HOURS
    if (bookingCalendarInfo != null) {
      const startDate = bookingCalendarInfo.start;
      const endDate = bookingCalendarInfo.end;
      const duration = endDate.getTime() - startDate.getTime();
      if (duration > 3.6e6 * 4) {
        throwError("Event duration exceeds 4 hours");
        return;
      }
      if (isWalkIn && duration < 3.6e6) {
        throwError("Walk-in event duration must be at least 1 hour");
        return;
      }
    }

    // ROOMS REQUIRE APPROVAL
    if (
      !isWalkIn &&
      !selectedRooms.every((room) =>
        INSTANT_APPROVAL_ROOMS.includes(room.roomId)
      )
    ) {
      throwError(
        "At least one of the requested rooms is not eligible for auto approval"
      );
      return;
    }

    if (!selectedAutoApprovalRooms(selectedRooms.map((room) => room.roomId))) {
      throwError(
        "Requests for multiple rooms (except for 2 ballrooms) will require full approval"
      );
      return;
    }

    // ROOM SETUP
    if (formData?.roomSetup === "yes") {
      throwError(
        "Requesting additional room setup for an event will require approval"
      );
      return;
    }

    // HAS MEDIA SERVICES
    if (!isWalkIn && formData?.mediaServices?.length > 0) {
      throwError(
        "Requesting media services for an event will require approval"
      );
      return;
    }

    // HAS CATERING
    if (formData?.catering === "yes") {
      throwError("Providing catering for an event will require approval");
      return;
    }

    // HAS SECURITY
    if (formData?.hireSecurity === "yes") {
      throwError("Hiring security for an event will require approval");
      return;
    }

    setIsAutoApproval(true);
    setErrorMessage(null);
  }, [
    // WARNING WARNING make sure to update this dep list if relying on new props
    bookingCalendarInfo,
    selectedRooms,
    formData,
  ]);

  return { isAutoApproval, errorMessage };
}
