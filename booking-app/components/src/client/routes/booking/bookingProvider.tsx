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
import { getAffectingBlackoutPeriods } from "../../../utils/blackoutUtils";
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
