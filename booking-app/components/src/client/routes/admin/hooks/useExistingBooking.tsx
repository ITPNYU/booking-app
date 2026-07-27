import { Department, Inputs, Role } from "@/components/src/types";
import { toBookingCalendarStr } from "@/components/src/client/utils/date";
import { getServiceSectionConfig } from "@/components/src/utils/resourceServicesUtils";

import { useContext } from "react";
import { BookingContext } from "../../booking/bookingProvider";
import { DatabaseContext } from "../../components/Provider";

export default function useExistingBooking() {
  const {
    setDepartment,
    setRole,
    setSelectedRooms,
    setBookingCalendarInfo,
    setFormData,
  } = useContext(BookingContext);
  const { allBookings, roomSettings } = useContext(DatabaseContext);

  const findBooking = (calendarEventId: string) =>
    allBookings.filter(
      (booking) => booking.calendarEventId === calendarEventId,
    )[0];

  const loadExistingBookingData = (calendarEventId: string) => {
    const booking = findBooking(calendarEventId);

    setDepartment(booking.department as Department);
    setRole(booking.role as Role);

    const roomIds = booking.roomId.split(",").map((roomId) => roomId.trim());
    const rooms = roomSettings.filter((roomSetting) =>
      roomIds.includes(roomSetting.roomId),
    );
    setSelectedRooms(rooms);

    const start = booking.startDate.toDate();
    const end = booking.endDate.toDate();
    const startStr = toBookingCalendarStr(start);
    const endStr = toBookingCalendarStr(end);
    setBookingCalendarInfo({
      start,
      end,
      startStr,
      endStr,
      allDay: false,
      jsEvent: null,
      view: null,
    });

    // Explicitly pick only Inputs fields so non-form status/audit fields (Timestamps,
    // xstateData snapshots, service flags, etc.) are never stored in formData and
    // never trigger expensive deep-comparisons in watch().
    const roomIdsForMaps = rooms.map((room) => String(room.roomId));

    /**
     * Convert a legacy flat string into a per-room map only when unambiguous.
     * - Prefer existing maps.
     * - If roomSettings have not loaded yet, keep flat legacy fields only.
     * - Single target room: safe 1:1 mapping.
     * - Multi-room: do not fan one legacy value onto every room.
     */
    const backfillPerRoomMap = (
      existing: Record<string, string> | undefined,
      legacyValue: string | undefined,
      targetRoomIds: string[] = roomIdsForMaps,
    ): Record<string, string> | undefined => {
      if (existing && Object.keys(existing).length > 0) return existing;
      if (!legacyValue) return existing;
      if (!targetRoomIds.length) return existing;
      if (targetRoomIds.length === 1) {
        return { [targetRoomIds[0]]: legacyValue };
      }
      return existing;
    };

    const legacySetupRequested =
      booking.roomSetup === "yes" ||
      (!!booking.setupDetails && booking.setupDetails.trim().length > 0);

    const setupTargetRooms = rooms.filter((room) => {
      const cfg = getServiceSectionConfig(room, "setup");
      return cfg?.mode === "radio" || cfg?.mode === "static" || !!cfg;
    });
    const setupTargetIds = setupTargetRooms.map((room) => String(room.roomId));

    const roomSetupByRoom =
      booking.roomSetupByRoom &&
      Object.keys(booking.roomSetupByRoom).length > 0
        ? booking.roomSetupByRoom
        : legacySetupRequested && setupTargetIds.length === 1
          ? (() => {
              const room = setupTargetRooms[0];
              const id = String(room.roomId);
              const cfg = getServiceSectionConfig(room, "setup");
              if (cfg?.mode === "radio" && (cfg.options?.length ?? 0) > 0) {
                const details = booking.setupDetails?.trim();
                const match = cfg.options!.find(
                  (o) =>
                    o.value === details ||
                    o.label === details ||
                    o.value === booking.roomSetup,
                );
                return {
                  [id]: match?.value ?? cfg.defaultValue ?? "",
                };
              }
              return {
                [id]:
                  booking.setupDetails?.trim() || booking.roomSetup || "yes",
              };
            })()
          : booking.roomSetupByRoom;

    const formValues: Inputs = {
      firstName: booking.firstName,
      lastName: booking.lastName,
      secondaryFirstName: booking.secondaryFirstName,
      secondaryLastName: booking.secondaryLastName,
      secondaryEmail: booking.secondaryEmail,
      secondaryName: booking.secondaryName,
      nNumber: booking.nNumber,
      netId: booking.netId,
      walkInNetId: booking.walkInNetId,
      phoneNumber: booking.phoneNumber,
      school: booking.school,
      otherSchool: booking.otherSchool,
      department: booking.department,
      otherDepartment: booking.otherDepartment,
      role: booking.role,
      sponsorFirstName: booking.sponsorFirstName,
      sponsorLastName: booking.sponsorLastName,
      sponsorEmail: booking.sponsorEmail,
      title: booking.title,
      description: booking.description,
      bookingType: booking.bookingType,
      attendeeAffiliation: booking.attendeeAffiliation,
      roomSetup: booking.roomSetup,
      setupDetails: booking.setupDetails,
      mediaServices: booking.mediaServices,
      mediaServicesDetails: booking.mediaServicesDetails,
      equipmentServices: booking.equipmentServices,
      equipmentServicesDetails: booking.equipmentServicesDetails,
      staffingServices: booking.staffingServices,
      staffingServicesDetails: booking.staffingServicesDetails,
      catering: booking.catering,
      hireSecurity: booking.hireSecurity,
      expectedAttendance: booking.expectedAttendance,
      cateringService: booking.cateringService,
      cleaningService: booking.cleaningService,
      missingEmail: booking.missingEmail,
      chartFieldForCatering: booking.chartFieldForCatering,
      chartFieldForCleaning: booking.chartFieldForCleaning,
      chartFieldForSecurity: booking.chartFieldForSecurity,
      chartFieldForRoomSetup: booking.chartFieldForRoomSetup,
      roomSetupByRoom,
      setupDetailsByRoom: backfillPerRoomMap(
        booking.setupDetailsByRoom,
        booking.setupDetails,
        setupTargetIds,
      ),
      chartFieldForRoomSetupByRoom: backfillPerRoomMap(
        booking.chartFieldForRoomSetupByRoom,
        booking.chartFieldForRoomSetup,
        setupTargetIds,
      ),
      furnishingsByRoom: booking.furnishingsByRoom,
      chartFieldForFurnishingsByRoom: booking.chartFieldForFurnishingsByRoom,
      equipmentServicesDetailsByRoom: backfillPerRoomMap(
        (booking as Inputs).equipmentServicesDetailsByRoom,
        booking.equipmentServicesDetails,
        roomIdsForMaps.length === 1 ? roomIdsForMaps : [],
      ),
      webcheckoutCartNumber: booking.webcheckoutCartNumber,
      equipment: booking.equipment,
      staffing: booking.staffing,
      cleaning: booking.cleaning,
      origin: booking.origin,
    };

    setFormData(formValues);
  };

  return loadExistingBookingData;
}
