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
    setAnnexByRoom,
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
    setAnnexByRoom(booking.annexByRoom ?? {});

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

    /**
     * Catering / cleaning / security used to be booking-level. When a booking
     * has no per-room map yet, spread the legacy answer (and its chartfield)
     * onto every selected room that offers the service, which is what the
     * booking-level value meant.
     */
    const isRequested = (value: unknown) =>
      typeof value === "string" &&
      value.trim() !== "" &&
      value.trim().toLowerCase() !== "no";
    const fanLegacyService = (
      key: "catering" | "cleaning" | "security",
      existing: Record<string, string> | undefined,
      existingChart: Record<string, string> | undefined,
      legacyValue: string | undefined,
      legacyChart: string | undefined,
    ) => {
      if (existing && Object.keys(existing).length > 0) {
        return { map: existing, chart: existingChart };
      }
      if (!isRequested(legacyValue)) return { map: existing, chart: existingChart };
      const targetIds = rooms
        .filter((room) => !!getServiceSectionConfig(room, key))
        .map((room) => String(room.roomId));
      if (!targetIds.length) return { map: existing, chart: existingChart };
      const map: Record<string, string> = {};
      const chart: Record<string, string> = {};
      const value = key === "security" ? legacyValue!.trim() : "yes";
      for (const id of targetIds) {
        map[id] = value;
        if (legacyChart?.trim()) chart[id] = legacyChart.trim();
      }
      return {
        map,
        chart: Object.keys(chart).length > 0 ? chart : existingChart,
      };
    };
    const cateringFan = fanLegacyService(
      "catering",
      booking.cateringByRoom,
      booking.chartFieldForCateringByRoom,
      booking.catering,
      booking.chartFieldForCatering,
    );
    const cleaningFan = fanLegacyService(
      "cleaning",
      booking.cleaningByRoom,
      booking.chartFieldForCleaningByRoom,
      booking.cleaningService,
      booking.chartFieldForCleaning,
    );
    const securityFan = fanLegacyService(
      "security",
      booking.hireSecurityByRoom,
      booking.chartFieldForSecurityByRoom,
      booking.hireSecurity,
      booking.chartFieldForSecurity,
    );

    const legacySetupRequested =
      booking.roomSetup === "yes" ||
      (!!booking.setupDetails && booking.setupDetails.trim().length > 0);

    const setupTargetRooms = rooms.filter((room) => {
      const cfg = getServiceSectionConfig(room, "setup");
      return (
        cfg?.mode === "radio" ||
        cfg?.mode === "select" ||
        cfg?.mode === "static" ||
        !!cfg
      );
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
              if (
                (cfg?.mode === "radio" || cfg?.mode === "select") &&
                (cfg.options?.length ?? 0) > 0
              ) {
                const details = booking.setupDetails?.trim();
                const match = cfg.options!.find(
                  (o) =>
                    o.value === details ||
                    o.label === details ||
                    o.value === booking.roomSetup,
                );
                // Do not silently substitute schema defaultValue — that can
                // erase the requester's original selection when options were
                // renamed after the booking was created. Keep legacy text in
                // setupDetails and leave the by-room map unset for manual review.
                if (match?.value) {
                  return { [id]: match.value };
                }
                return undefined;
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
      furnishingsDetails: booking.furnishingsDetails ?? "",
      furnishingsDetailsByRoom: backfillPerRoomMap(
        booking.furnishingsDetailsByRoom,
        booking.furnishingsDetails,
        roomIdsForMaps.length === 1 ? roomIdsForMaps : [],
      ),
      equipmentServicesDetailsByRoom: backfillPerRoomMap(
        (booking as Inputs).equipmentServicesDetailsByRoom,
        booking.equipmentServicesDetails,
        roomIdsForMaps.length === 1 ? roomIdsForMaps : [],
      ),
      cateringByRoom: cateringFan.map,
      chartFieldForCateringByRoom: cateringFan.chart,
      cleaningByRoom: cleaningFan.map,
      chartFieldForCleaningByRoom: cleaningFan.chart,
      hireSecurityByRoom: securityFan.map,
      chartFieldForSecurityByRoom: securityFan.chart,
      annexByRoom: booking.annexByRoom ?? {},
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
