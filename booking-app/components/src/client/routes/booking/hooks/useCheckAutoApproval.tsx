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
import { Role } from "../../../../types";

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
        equipmentServices: formData?.equipmentServices,
        staffingServices: formData?.staffingServices,
        catering: formData?.catering,
        hireSecurity: formData?.hireSecurity,
      },
      bookingDuration: bookingCalendarInfo
        ? `${((bookingCalendarInfo.end.getTime() - bookingCalendarInfo.start.getTime()) / (1000 * 60 * 60)).toFixed(1)} hours`
        : "Not set",
    }
  );

  useEffect(() => {
    // Check duration limits based on resource maxHour
    if (bookingCalendarInfo != null && role && selectedRooms.length > 0) {
      const startDate = bookingCalendarInfo.start;
      const endDate = bookingCalendarInfo.end;
      const duration = endDate.getTime() - startDate.getTime();
      const durationHours = duration / (1000 * 60 * 60);

      // Check each selected room's duration limit
      for (const room of selectedRooms) {
        const resource = schema.resources.find((r) => r.roomId === room.roomId);
        if (resource?.maxHour) {
          let maxHours: number;
          switch (role) {
            case Role.STUDENT:
              maxHours = resource.maxHour.student;
              break;
            case Role.FACULTY:
              maxHours = resource.maxHour.faculty;
              break;
            case Role.ADMIN_STAFF:
            case Role.CHAIR_PROGRAM_DIRECTOR:
            case Role.RESIDENT_FELLOW:
              maxHours = resource.maxHour.admin;
              break;
            default:
              maxHours = resource.maxHour.admin;
          }

          if (durationHours > maxHours) {
            throwError(
              `Event duration (${durationHours.toFixed(1)} hours) exceeds the maximum allowed duration (${maxHours} hours) for ${room.roomId} ${room.name}`
            );
            return;
          }
        }
      }
    }

    // For ITP and Media Commons tenants, use XState machine for auto-approval logic
    if (schema.tenant === TENANTS.ITP || isMediaCommonsTenant(schema.tenant)) {
      console.log(
        `🎭 CLIENT-SIDE XSTATE CHECK [${schema.tenant?.toUpperCase()}]:`,
        {
          tenant: schema.tenant,
          selectedRooms: selectedRooms?.map((r) => ({
            roomId: r.roomId,
            name: r.name,
            shouldAutoApprove: r.shouldAutoApprove,
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
            // Media Commons specific fields
            ...(isMediaCommonsTenant(schema.tenant) && {
              servicesRequested,
              servicesApproved: {}, // Initially no services are approved
              isVip: false, // Regular user booking (not VIP)
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
            `✅ AUTO-APPROVAL APPROVED [${schema.tenant?.toUpperCase()}]:`,
            "XState machine approved auto-approval"
          );
          setIsAutoApproval(true);
          setErrorMessage(null);
        } else {
          console.log(
            `🚫 AUTO-APPROVAL REJECTED [${schema.tenant?.toUpperCase()}]:`,
            "XState machine rejected auto-approval"
          );
          setIsAutoApproval(false);
          setErrorMessage(
            "XState machine determined manual approval is required"
          );
        }
      } catch (error) {
        console.error(`🚨 CLIENT-SIDE XSTATE ERROR [${schema.tenant?.toUpperCase()}]:`, error);
        // Fallback to traditional logic if XState fails
        setIsAutoApproval(false);
        setErrorMessage("XState evaluation failed, manual approval required");
      }

      return; // Exit early for ITP and Media Commons tenants
    }

    // Traditional logic for non-ITP tenants
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

    // HAS EQUIPMENT SERVICES
    if (!isWalkIn && formData?.equipmentServices?.length > 0) {

      throwError(
        "Requesting equipment services for an event will require approval"
      );
      return;
    }

    // HAS STAFFING SERVICES
    if (!isWalkIn && formData?.staffingServices?.length > 0) {
      throwError(
        "Requesting staffing services for an event will require approval"
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
    schema.tenant, // Added tenant to dependencies
    isWalkIn, // Added isWalkIn to dependencies
    role, // Added role to dependencies
  ]);

  console.log(
    `📋 AUTO-APPROVAL RESULT [${schema.tenant?.toUpperCase() || "UNKNOWN"}]:`,
    {
      isAutoApproval,
      errorMessage,
      finalDecision: isAutoApproval ? "APPROVED" : "REJECTED",
      usingXState:
        schema.tenant === TENANTS.ITP || isMediaCommonsTenant(schema.tenant),
      method:
        schema.tenant === TENANTS.ITP || isMediaCommonsTenant(schema.tenant)
          ? "XState Machine"
          : "Traditional Logic",
    }
  );

  return { isAutoApproval, errorMessage };
}
