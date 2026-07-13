import {
  TENANTS,
  isMediaCommonsTenant,
} from "@/components/src/constants/tenants";
import { getMediaCommonsServices } from "@/components/src/utils/tenantUtils";
import {
  evaluateItpShouldAutoApprove,
  evaluateMcShouldAutoApprove,
} from "@/lib/stateMachines/autoApprovalGuards";
import { useContext, useEffect, useState } from "react";
import { checkAutoApprovalEligibility } from "@/lib/utils/autoApprovalUtils";
import { useTenantSchema } from "../../components/SchemaProvider";
import { BookingContext } from "../bookingProvider";

export function selectedAutoApprovalRooms(
  selectedRoomIds: string[],
  selectedRooms: any[],
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

export default function useCheckAutoApproval(
  isWalkIn = false,
  isVIP = false,
  skipCheck = false,
) {
  const { bookingCalendarInfo, selectedRooms, formData, role } =
    useContext(BookingContext);
  const schema = useTenantSchema();

  const [isAutoApproval, setIsAutoApproval] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const throwError = (msg: string) => {
    console.log(
      `🚫 AUTO-APPROVAL REJECTED [${schema.tenantId?.toUpperCase() || "UNKNOWN"}]:`,
      msg,
    );
    setIsAutoApproval(false);
    setErrorMessage(msg);
  };

  useEffect(() => {
    if (skipCheck) {
      setIsAutoApproval(true);
      setErrorMessage(null);
      return;
    }

    // ITP / MC: use shared guard logic (same as server XState machines, no server imports).
    if (
      schema.tenantId === TENANTS.ITP ||
      isMediaCommonsTenant(schema.tenantId)
    ) {
      const bookingCalendarInput = bookingCalendarInfo
        ? {
            startStr: bookingCalendarInfo.start.toISOString(),
            endStr: bookingCalendarInfo.end.toISOString(),
          }
        : null;

      const canAutoApprove =
        schema.tenantId === TENANTS.ITP
          ? evaluateItpShouldAutoApprove({
              tenant: schema.tenantId,
              selectedRooms,
              formData,
              bookingCalendarInfo: bookingCalendarInput,
              isWalkIn,
              role,
            })
          : evaluateMcShouldAutoApprove({
              tenant: schema.tenantId,
              selectedRooms,
              bookingCalendarInfo: bookingCalendarInput,
              isWalkIn,
              isVip: isVIP,
              role,
              servicesRequested: getMediaCommonsServices(formData || {}),
            });

      if (canAutoApprove) {
        setIsAutoApproval(true);
        setErrorMessage(null);
      } else {
        setIsAutoApproval(false);
        setErrorMessage(
          "This booking does not meet the auto-approval requirements",
        );
      }

      return;
    }

    // Traditional logic for non-ITP/MC tenants - now using new autoApprovalUtils

    // Calculate duration
    let durationHours: number | undefined;
    if (bookingCalendarInfo != null) {
      const startDate = bookingCalendarInfo.start;
      const endDate = bookingCalendarInfo.end;
      const duration = endDate.getTime() - startDate.getTime();
      durationHours = duration / (1000 * 60 * 60); // Convert ms to hours
    }

    // Check multiple room restrictions (legacy check)
    if (
      !selectedAutoApprovalRooms(
        selectedRooms.map((room) => room.roomId),
        selectedRooms,
      )
    ) {
      throwError(
        "Requests for multiple rooms (except for 2 ballrooms) will require full approval",
      );
      return;
    }

    // Map formData to servicesRequested (cleaningService shown when room.services includes "cleaning")
    const servicesRequested = formData
      ? {
          setup: formData.roomSetup === "yes",
          equipment: !isWalkIn && formData.equipmentServices?.length > 0,
          staffing: !isWalkIn && formData.staffingServices?.length > 0,
          catering: formData.catering === "yes",
          cleaning: formData.cleaningService === "yes",
          security: formData.hireSecurity === "yes",
        }
      : undefined;

    console.log(
      `🔍 AUTO-APPROVAL CHECK [${schema.tenantId?.toUpperCase() || "UNKNOWN"}]:`,
      {
        role,
        isWalkIn,
        isVIP,
        durationHours,
        servicesRequested,
        selectedRoomsCount: selectedRooms.length,
      },
    );

    const result = checkAutoApprovalEligibility({
      selectedRooms,
      role,
      isWalkIn,
      isVip: isVIP,
      durationHours,
      servicesRequested,
    });

    if (!result.canAutoApprove) {
      throwError(
        result.reason || "Booking does not meet auto-approval requirements",
      );
      return;
    }

    console.log(
      `✅ AUTO-APPROVAL APPROVED [${schema.tenantId?.toUpperCase() || "UNKNOWN"}]:`,
      result.reason,
    );
    setIsAutoApproval(true);
    setErrorMessage(null);
  }, [
    bookingCalendarInfo,
    selectedRooms,
    formData,
    schema.resources,
    schema.tenantId,
    isWalkIn,
    isVIP,
    role,
    skipCheck,
  ]);

  return { isAutoApproval, errorMessage };
}
