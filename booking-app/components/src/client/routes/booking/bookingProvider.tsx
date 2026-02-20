import { createContext, useContext, useEffect, useMemo, useState } from "react";
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
import { getAffectingBlackoutPeriods } from "../../../utils/blackoutUtils";
import { DatabaseContext } from "../components/Provider";
import fetchCalendarEvents from "./hooks/fetchCalendarEvents";
import { useTenantSchema } from "../components/SchemaProvider";

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
    reloadSafetyTrainedUsers,
  } = useContext(DatabaseContext);
  const pathname = usePathname();
  const schema = useTenantSchema();

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

  // Update safety trained users when selected rooms change
  // Each room may have a different trainingFormUrl, so we need to merge results from all rooms
  useEffect(() => {
    if (selectedRooms.length > 0) {
      // Collect all rooms that require safety training and have a trainingFormUrl
      const roomsWithTraining = selectedRooms
        .filter((room) => room.needsSafetyTraining && room.trainingFormUrl)
        .map((room) => ({
          roomId: room.roomId.toString(),
          trainingFormUrl: room.trainingFormUrl,
        }));

      if (roomsWithTraining.length > 0) {
        // Fetch and merge safety trained users from all selected rooms
        reloadSafetyTrainedUsers(roomsWithTraining);
      } else {
        // If no room requires training or no trainingFormUrl, fetch all (no resource filter)
        reloadSafetyTrainedUsers();
      }
    } else {
      // No rooms selected, fetch all safety trained users
      reloadSafetyTrainedUsers();
    }
  }, [selectedRooms, reloadSafetyTrainedUsers]);

  const isBanned = useMemo<boolean>(() => {
    const bannedEmails = bannedUsers.map((bannedUser) => bannedUser.email);

    // For walk-in bookings, check if the walk-in person (not the PA) is banned
    if (pathname.includes("/walk-in") && formData?.walkInNetId?.length > 0) {
      return bannedEmails.includes(formData?.walkInNetId + "@nyu.edu");
    }

    if (!userEmail) return false;
    return bannedEmails.includes(userEmail);
  }, [userEmail, bannedUsers, formData?.walkInNetId, pathname]);

  const isSafetyTrained = useMemo(() => {
    const safetyTrainedEmails = safetyTrainedUsers.map((user) => user.email);

    // For walk-in bookings, check if the walk-in person (not the PA) has safety training
    if (pathname.includes("/walk-in") && formData?.walkInNetId?.length > 0) {
      return safetyTrainedEmails.includes(formData?.walkInNetId + "@nyu.edu");
    }

    if (!userEmail) return false;
    return safetyTrainedEmails.includes(userEmail);
  }, [userEmail, safetyTrainedUsers, formData?.walkInNetId, pathname]);

  // block progressing in the form is safety training requirement isn't met
  const needsSafetyTraining = useMemo(() => {
    const isStudent = role === Role.STUDENT;
    const roomRequiresSafetyTraining = selectedRooms.some((room) => {
      return room.needsSafetyTraining || false;
    });
    return isStudent && roomRequiresSafetyTraining && !isSafetyTrained;
  }, [selectedRooms, role, isSafetyTrained]);

  // Check if the booking falls within any active blackout period
  const isInBlackoutPeriod = useMemo(() => {
    if (!bookingCalendarInfo || !blackoutPeriods) return false;

    const bookingStart = dayjs(bookingCalendarInfo.start);
    const bookingEnd = dayjs(bookingCalendarInfo.end);
    const selectedRoomIds = selectedRooms.map((room) => room.roomId);

    const affectingPeriods = getAffectingBlackoutPeriods(
      blackoutPeriods,
      bookingStart,
      bookingEnd,
      selectedRoomIds
    );

    return affectingPeriods.length > 0;
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
