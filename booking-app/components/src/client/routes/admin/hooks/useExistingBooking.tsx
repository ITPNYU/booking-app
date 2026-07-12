import { Department, Inputs, Role } from "@/components/src/types";
import { toBookingCalendarStr } from "@/components/src/client/utils/date";

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

    const backfillPerRoomMap = (
      existing: Record<string, string> | undefined,
      legacyValue: string | undefined,
    ): Record<string, string> | undefined => {
      if (existing && Object.keys(existing).length > 0) return existing;
      if (!legacyValue || !roomIdsForMaps.length) return existing;
      return Object.fromEntries(roomIdsForMaps.map((id) => [id, legacyValue]));
    };

    const legacySetupRequested =
      booking.roomSetup === "yes" ||
      (!!booking.setupDetails && booking.setupDetails.trim().length > 0);

    const roomSetupByRoom =
      booking.roomSetupByRoom &&
      Object.keys(booking.roomSetupByRoom).length > 0
        ? booking.roomSetupByRoom
        : legacySetupRequested
          ? Object.fromEntries(
              roomIdsForMaps.map((id) => [
                id,
                // Prefer free-text details as the preserved answer; radio may not match.
                booking.setupDetails?.trim() || booking.roomSetup || "yes",
              ]),
            )
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
      ),
      chartFieldForRoomSetupByRoom: backfillPerRoomMap(
        booking.chartFieldForRoomSetupByRoom,
        booking.chartFieldForRoomSetup,
      ),
      furnishingsByRoom: booking.furnishingsByRoom,
      chartFieldForFurnishingsByRoom: booking.chartFieldForFurnishingsByRoom,
      studentLoungeByRoom: booking.studentLoungeByRoom,
      auxiliarySpaceByRoom:
        booking.auxiliarySpaceByRoom &&
        Object.keys(booking.auxiliarySpaceByRoom).length > 0
          ? booking.auxiliarySpaceByRoom
          : booking.auxiliarySpaceRequested
            ? Object.fromEntries(roomIdsForMaps.map((id) => [id, "yes"]))
            : booking.auxiliarySpaceByRoom,
      auxiliarySpaceRequested: booking.auxiliarySpaceRequested,
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
