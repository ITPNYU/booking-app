import {
  TENANTS,
  isMediaCommonsTenant,
} from "@/components/src/constants/tenants";
import { getMediaCommonsServices } from "@/components/src/utils/tenantUtils";
import { itpBookingMachine } from "@/lib/stateMachines/itpBookingMachine";
import { mcBookingMachine } from "@/lib/stateMachines/mcBookingMachine";
import { useContext, useEffect, useState } from "react";
import { createActor } from "xstate";
import { useTenantSchema } from "../../components/SchemaProvider";
import { BookingContext } from "../bookingProvider";
import { getBookingHourLimits } from "../utils/bookingHourLimits";
import { checkAutoApprovalEligibility } from "@/lib/utils/autoApprovalUtils";

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

export default function useCheckAutoApproval(isWalkIn = false, isVIP = false) {
  const { bookingCalendarInfo, selectedRooms, formData, role } =
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

  useEffect(() => {
    // For ITP and Media Commons tenants, use XState machine for auto-approval logic
    if (schema.tenant === TENANTS.ITP || isMediaCommonsTenant(schema.tenant)) {
      console.log(
        `🎭 CLIENT-SIDE XSTATE CHECK [${schema.tenant?.toUpperCase()}]:`,
        {
          tenant: schema.tenant,
          selectedRooms: selectedRooms?.map((r) => ({
            roomId: r.roomId,
            name: r.name,
            autoApproval: r.autoApproval,
          })),
          formData,
          bookingCalendarInfo: bookingCalendarInfo
            ? {
                startStr: bookingCalendarInfo.start.toISOString(),
                endStr: bookingCalendarInfo.end.toISOString(),
                duration: `${((bookingCalendarInfo.end.getTime() - bookingCalendarInfo.start.getTime()) / (1000 * 60 * 60)).toFixed(1)} hours`,
              }
            : null,
          isWalkIn,
        }
      );

      try {
        // Choose the appropriate machine based on tenant
        const machine =
          schema.tenant === TENANTS.ITP ? itpBookingMachine : mcBookingMachine;

        // For Media Commons, prepare services data
        const servicesRequested = isMediaCommonsTenant(schema.tenant)
          ? getMediaCommonsServices(formData || {})
          : {};

        const bookingActor = createActor(machine, {
          input: {
            tenant: schema.tenant,
            selectedRooms,
            formData,
            bookingCalendarInfo: bookingCalendarInfo
              ? {
                  startStr: bookingCalendarInfo.start.toISOString(),
                  endStr: bookingCalendarInfo.end.toISOString(),
                }
              : null,
            isWalkIn,
            isVip: isVIP,
            role,
            // Media Commons specific fields
            ...(isMediaCommonsTenant(schema.tenant) && {
              servicesRequested,
              servicesApproved: {}, // Initially no services are approved
              email: "user@example.com", // Placeholder
              calendarEventId: "temp-id", // Placeholder
            }),
          },
        });

        bookingActor.start();
        const currentState = bookingActor.getSnapshot();
        const xstateDecision = currentState.value === "Approved";

        console.log(
          `🎭 CLIENT-SIDE XSTATE RESULT [${schema.tenant?.toUpperCase()}]:`,
          {
            state: currentState.value,
            decision: xstateDecision ? "AUTO-APPROVE" : "MANUAL-APPROVAL",
            context: {
              tenant: currentState.context.tenant,
              selectedRoomsCount: currentState.context.selectedRooms?.length,
              hasFormData: !!currentState.context.formData,
              isWalkIn: currentState.context.isWalkIn,
              // Media Commons specific context
              ...(isMediaCommonsTenant(schema.tenant) && {
                servicesRequested: (currentState.context as any)
                  .servicesRequested,
                hasServices: (currentState.context as any).servicesRequested
                  ? Object.values(
                      (currentState.context as any).servicesRequested
                    ).some(Boolean)
                  : false,
                isVip: (currentState.context as any).isVip,
              }),
            },
          }
        );

        bookingActor.stop();

        if (xstateDecision) {
          console.log(
            `✅ AUTO-APPROVAL APPROVED [ITP]:`,
            "XState machine approved auto-approval"
          );
          setIsAutoApproval(true);
          setErrorMessage(null);
        } else {
          console.log(
            `🚫 AUTO-APPROVAL REJECTED [ITP]:`,
            "XState machine rejected auto-approval"
          );
          setIsAutoApproval(false);
          setErrorMessage(
            "This booking does not meet the auto-approval requirements"
          );
        }
      } catch (error) {
        console.error(`🚨 CLIENT-SIDE XSTATE ERROR [ITP]:`, error);
        // Fallback to traditional logic if XState fails
        setIsAutoApproval(false);
        setErrorMessage("Unable to determine auto-approval eligibility");
      }

      return; // Exit early for ITP tenant
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
        selectedRooms
      )
    ) {
      throwError(
        "Requests for multiple rooms (except for 2 ballrooms) will require full approval"
      );
      return;
    }

    // Map formData to servicesRequested (cleaningService shown when room.services includes "cleaning")
    const servicesRequested = formData ? {
      setup: formData.roomSetup === "yes",
      equipment: !isWalkIn && formData.equipmentServices?.length > 0,
      staffing: !isWalkIn && formData.staffingServices?.length > 0,
      catering: formData.catering === "yes",
      cleaning: formData.cleaningService === "yes",
      security: formData.hireSecurity === "yes",
    } : undefined;

    console.log(
      `🔍 AUTO-APPROVAL CHECK USING NEW UTILS [${schema.tenant?.toUpperCase() || "UNKNOWN"}]:`,
      {
        role,
        isWalkIn,
        isVIP,
        durationHours,
        servicesRequested,
        selectedRoomsCount: selectedRooms.length,
      }
    );

    // Use the new auto-approval utility
    const result = checkAutoApprovalEligibility({
      selectedRooms,
      role,
      isWalkIn,
      isVip: isVIP,
      durationHours,
      servicesRequested,
    });

    if (!result.canAutoApprove) {
      throwError(result.reason || "Booking does not meet auto-approval requirements");
      return;
    }

    console.log(
      `✅ AUTO-APPROVAL APPROVED [${schema.tenant?.toUpperCase() || "UNKNOWN"}]:`,
      result.reason
    );
    setIsAutoApproval(true);
    setErrorMessage(null);
  }, [
    // WARNING WARNING make sure to update this dep list if relying on new props
    bookingCalendarInfo,
    selectedRooms,
    formData,
    schema.resources,
    schema.tenant, // Added tenant to dependencies
    isWalkIn, // Added isWalkIn to dependencies
  ]);

  return { isAutoApproval, errorMessage };
}
