import { useContext, useEffect, useState } from "react";
import { useTenantSchema } from "../../components/SchemaProvider";
import { BookingContext } from "../bookingProvider";

export function selectedAutoApprovalRooms(
  selectedRoomIds: number[],
  selectedRooms: any[]
) {
  if (selectedRoomIds.length < 2) return true;
  if (selectedRoomIds.length > 2) return false;

  const room1 = selectedRooms.find((r: any) => r.roomId === selectedRoomIds[0]);
  const room2 = selectedRooms.find((r: any) => r.roomId === selectedRoomIds[1]);

  if (room1?.isWalkInCanBookTwo && room2?.isWalkInCanBookTwo) {
    return true;
  }
  return false;
}

export default function useCheckAutoApproval(isWalkIn = false) {
  const { bookingCalendarInfo, selectedRooms, formData } =
    useContext(BookingContext);
  const schema = useTenantSchema();

  const [isAutoApproval, setIsAutoApproval] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const throwError = (msg: string) => {
    console.log(
      `🚫 AUTO-APPROVAL REJECTED [${schema.tenant?.toUpperCase() || "UNKNOWN"}]:`,
      msg
    );
    setIsAutoApproval(false);
    setErrorMessage(msg);
  };

  console.log(
    `🔍 AUTO-APPROVAL CHECK [${schema.tenant?.toUpperCase() || "UNKNOWN"}]:`,
    {
      tenant: schema.tenant,
      isWalkIn,
      selectedRoomsCount: selectedRooms?.length || 0,
      selectedRooms: selectedRooms?.map((r) => ({
        roomId: r.roomId,
        name: r.name,
        shouldAutoApprove: r.shouldAutoApprove,
      })),
      formData: {
        roomSetup: formData?.roomSetup,
        mediaServices: formData?.mediaServices,
        catering: formData?.catering,
        hireSecurity: formData?.hireSecurity,
      },
      bookingDuration: bookingCalendarInfo
        ? `${((bookingCalendarInfo.end.getTime() - bookingCalendarInfo.start.getTime()) / (1000 * 60 * 60)).toFixed(1)} hours`
        : "Not set",
    }
  );

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
      !selectedRooms.every((room) => {
        return room.shouldAutoApprove || false;
      })
    ) {
      throwError(
        "At least one of the requested rooms is not eligible for auto approval"
      );
      return;
    }

    if (
      !selectedAutoApprovalRooms(
        selectedRooms.map((room) => room.roomId),
        selectedRooms
      )
    ) {
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

    console.log(
      `✅ AUTO-APPROVAL APPROVED [${schema.tenant?.toUpperCase() || "UNKNOWN"}]:`,
      "All conditions met for auto-approval"
    );
    setIsAutoApproval(true);
    setErrorMessage(null);
  }, [
    // WARNING WARNING make sure to update this dep list if relying on new props
    bookingCalendarInfo,
    selectedRooms,
    formData,
    schema.resources,
  ]);

  console.log(
    `📋 AUTO-APPROVAL RESULT [${schema.tenant?.toUpperCase() || "UNKNOWN"}]:`,
    {
      isAutoApproval,
      errorMessage,
      finalDecision: isAutoApproval ? "APPROVED" : "REJECTED",
    }
  );

  return { isAutoApproval, errorMessage };
}
