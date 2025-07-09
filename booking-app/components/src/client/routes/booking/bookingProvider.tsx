import { createContext, useContext, useMemo, useState } from "react";
import {
  CalendarEvent,
  Department,
  Inputs,
  Role,
  RoomSetting,
  SubmitStatus,
} from "../../../types";

import { DateSelectArg } from "@fullcalendar/core";
import dayjs from "dayjs";
import { usePathname } from "next/navigation";
import { SAFETY_TRAINING_REQUIRED_ROOM } from "../../../mediaCommonsPolicy";
import { DatabaseContext } from "../components/Provider";
import fetchCalendarEvents from "./hooks/fetchCalendarEvents";

export interface BookingContextType {
  bookingCalendarInfo: DateSelectArg | undefined;
  department: Department | undefined;
  existingCalendarEvents: CalendarEvent[];
  formData: Inputs | undefined;
  hasShownMocapModal: boolean;
  isBanned: boolean;
  isSafetyTrained: boolean;
  needsSafetyTraining: boolean;
  isInBlackoutPeriod: boolean;
  reloadExistingCalendarEvents: () => void;
  role: Role | undefined;
  selectedRooms: RoomSetting[];
  setBookingCalendarInfo: (x: DateSelectArg) => void;
  setDepartment: (x: Department) => void;
  setFormData: (x: Inputs) => void;
  setHasShownMocapModal: (x: boolean) => void;
  setRole: (x: Role) => void;
  setSelectedRooms: (x: RoomSetting[]) => void;
  setSubmitting: (x: SubmitStatus) => void;
  submitting: SubmitStatus;
  fetchingStatus: "loading" | "loaded" | "error" | null;
  error: Error | null;
  setError: (x: Error | null) => void;
}

export const BookingContext = createContext<BookingContextType>({
  bookingCalendarInfo: undefined,
  department: undefined,
  existingCalendarEvents: [],
  formData: undefined,
  hasShownMocapModal: false,
  isBanned: false,
  isSafetyTrained: true,
  needsSafetyTraining: false,
  isInBlackoutPeriod: false,
  reloadExistingCalendarEvents: () => {},
  role: undefined,
  selectedRooms: [],
  setBookingCalendarInfo: (x: DateSelectArg) => {},
  setDepartment: (x: Department) => {},
  setFormData: (x: Inputs) => {},
  setHasShownMocapModal: (x: boolean) => {},
  setRole: (x: Role) => {},
  setSelectedRooms: (x: RoomSetting[]) => {},
  setSubmitting: (x: SubmitStatus) => {},
  submitting: "none",
  fetchingStatus: null,
  error: null,
  setError: (x: Error | null) => {},
});

export function BookingProvider({ children }) {
  const {
    bannedUsers,
    roomSettings,
    safetyTrainedUsers,
    userEmail,
    blackoutPeriods,
  } = useContext(DatabaseContext);
  const pathname = usePathname();

  const [bookingCalendarInfo, setBookingCalendarInfo] =
    useState<DateSelectArg>();
  const [department, setDepartment] = useState<Department>();
  const [formData, setFormData] = useState<Inputs>(undefined);
  const [hasShownMocapModal, setHasShownMocapModal] = useState(false);
  const [role, setRole] = useState<Role>();
  const [selectedRooms, setSelectedRooms] = useState<RoomSetting[]>([]);
  const [submitting, setSubmitting] = useState<SubmitStatus>("error");
  const {
    existingCalendarEvents,
    reloadExistingCalendarEvents,
    fetchingStatus,
  } = fetchCalendarEvents(roomSettings);
  const [error, setError] = useState<Error | null>(null);

  const isBanned = useMemo<boolean>(() => {
    const bannedEmails = bannedUsers.map((bannedUser) => bannedUser.email);

    if (pathname.includes("/walk-in/form") && formData?.netId?.length > 0) {
      return bannedEmails.includes(formData?.netId + "@nyu.edu");
    }

    if (!userEmail) return false;
    return bannedEmails.includes(userEmail);
  }, [userEmail, bannedUsers, formData?.netId, pathname]);

  const isSafetyTrained = useMemo(() => {
    const safetyTrainedEmails = safetyTrainedUsers.map((user) => user.email);

    if (pathname.includes("/walk-in/form") && formData?.netId?.length > 0) {
      return safetyTrainedEmails.includes(formData?.netId + "@nyu.edu");
    }

    if (!userEmail) return;
    return safetyTrainedEmails.includes(userEmail);
  }, [userEmail, safetyTrainedUsers, formData?.netId, pathname]);

  // block progressing in the form is safety training requirement isn't met
  const needsSafetyTraining = useMemo(() => {
    const isStudent = role === Role.STUDENT;
    const roomRequiresSafetyTraining = selectedRooms.some((room) =>
      SAFETY_TRAINING_REQUIRED_ROOM.includes(room.roomId)
    );
    return isStudent && roomRequiresSafetyTraining && !isSafetyTrained;
  }, [selectedRooms, role, isSafetyTrained]);

  // Check if the booking falls within any active blackout period
  const isInBlackoutPeriod = useMemo(() => {
    if (!bookingCalendarInfo || !blackoutPeriods) return false;

    const bookingStart = dayjs(bookingCalendarInfo.start);
    const bookingEnd = dayjs(bookingCalendarInfo.end);
    const activeBlackoutPeriods = blackoutPeriods.filter(
      (period) => period.isActive
    );

    // Get room IDs from selected rooms
    const selectedRoomIds = selectedRooms.map((room) => room.roomId);

    return activeBlackoutPeriods.some((period) => {
      const startDate = dayjs(period.startDate.toDate());
      const endDate = dayjs(period.endDate.toDate());

      // Helper function to check if booking time overlaps with blackout period
      const isTimeInBlackoutPeriod = (
        checkDate: dayjs.Dayjs,
        bookingStartTime: dayjs.Dayjs,
        bookingEndTime: dayjs.Dayjs
      ) => {
        // If no specific times are set, blackout applies to entire day
        if (!period.startTime || !period.endTime) {
          return true;
        }

        const isStartDate = checkDate.isSame(startDate, "day");
        const isEndDate = checkDate.isSame(endDate, "day");
        const isSameDay = startDate.isSame(endDate, "day");

        if (isSameDay) {
          // Single day blackout - use specified time range
          const [startHour, startMinute] = period.startTime
            .split(":")
            .map(Number);
          const [endHour, endMinute] = period.endTime.split(":").map(Number);

          const blackoutStart = checkDate
            .hour(startHour)
            .minute(startMinute)
            .second(0)
            .millisecond(0);
          const blackoutEnd = checkDate
            .hour(endHour)
            .minute(endMinute)
            .second(0)
            .millisecond(0);

          // Handle case where blackout end time is before start time (spans midnight)
          const actualBlackoutEnd = blackoutEnd.isBefore(blackoutStart)
            ? blackoutEnd.add(1, "day")
            : blackoutEnd;

          // Check if booking time overlaps with blackout time
          return (
            (bookingStartTime.isBefore(actualBlackoutEnd) &&
              bookingEndTime.isAfter(blackoutStart)) ||
            bookingStartTime.isSame(blackoutStart) ||
            bookingEndTime.isSame(actualBlackoutEnd)
          );
        } else {
          // Multi-day blackout period
          if (isStartDate) {
            // Start date: blackout from start time to end of day
            const [startHour, startMinute] = period.startTime
              .split(":")
              .map(Number);
            const blackoutStart = checkDate
              .hour(startHour)
              .minute(startMinute)
              .second(0)
              .millisecond(0);
            const blackoutEnd = checkDate.endOf("day");

            return (
              (bookingStartTime.isBefore(blackoutEnd) &&
                bookingEndTime.isAfter(blackoutStart)) ||
              bookingStartTime.isSame(blackoutStart) ||
              bookingEndTime.isSame(blackoutEnd)
            );
          } else if (isEndDate) {
            // End date: blackout from start of day to end time
            const [endHour, endMinute] = period.endTime.split(":").map(Number);
            const blackoutStart = checkDate.startOf("day");
            const blackoutEnd = checkDate
              .hour(endHour)
              .minute(endMinute)
              .second(0)
              .millisecond(0);

            return (
              (bookingStartTime.isBefore(blackoutEnd) &&
                bookingEndTime.isAfter(blackoutStart)) ||
              bookingStartTime.isSame(blackoutStart) ||
              bookingEndTime.isSame(blackoutEnd)
            );
          } else {
            // Middle day: blackout entire day
            return true;
          }
        }
      };

      // Check each day of the blackout period
      let currentDate = startDate.startOf("day");
      const endDateEndOfDay = endDate.endOf("day");

      while (
        currentDate.isBefore(endDateEndOfDay, "day") ||
        currentDate.isSame(endDateEndOfDay, "day")
      ) {
        // Check if booking date matches current blackout date
        const bookingStartDay = bookingStart.startOf("day");
        const bookingEndDay = bookingEnd.startOf("day");

        const isBookingOnThisDay =
          bookingStartDay.isSame(currentDate, "day") ||
          bookingEndDay.isSame(currentDate, "day") ||
          (bookingStartDay.isBefore(currentDate, "day") &&
            bookingEndDay.isAfter(currentDate, "day"));

        if (isBookingOnThisDay) {
          // Get the booking times for this specific day
          let dayBookingStart = bookingStart;
          let dayBookingEnd = bookingEnd;

          // If booking spans multiple days, adjust times for this specific day
          if (!bookingStart.isSame(currentDate, "day")) {
            dayBookingStart = currentDate.startOf("day");
          }
          if (!bookingEnd.isSame(currentDate, "day")) {
            dayBookingEnd = currentDate.endOf("day");
          }

          // Check if the booking time on this day overlaps with blackout period
          if (
            isTimeInBlackoutPeriod(currentDate, dayBookingStart, dayBookingEnd)
          ) {
            // Check room restrictions
            if (!period.roomIds || period.roomIds.length === 0) {
              return true; // Global blackout applies to all rooms
            }

            // Check if any of the selected rooms are in the blackout period
            if (
              selectedRoomIds.some((roomId) => period.roomIds!.includes(roomId))
            ) {
              return true;
            }
          }
        }

        currentDate = currentDate.add(1, "day");
      }

      return false;
    });
  }, [bookingCalendarInfo, blackoutPeriods, selectedRooms]);

  return (
    <BookingContext.Provider
      value={{
        bookingCalendarInfo,
        department,
        existingCalendarEvents,
        reloadExistingCalendarEvents,
        formData,
        hasShownMocapModal,
        isBanned,
        isSafetyTrained,
        needsSafetyTraining,
        isInBlackoutPeriod,
        role,
        selectedRooms,
        setBookingCalendarInfo,
        setDepartment,
        setFormData,
        setHasShownMocapModal,
        setRole,
        setSelectedRooms,
        setSubmitting,
        submitting,
        fetchingStatus,
        error,
        setError,
      }}
    >
      {children}
    </BookingContext.Provider>
  );
}
