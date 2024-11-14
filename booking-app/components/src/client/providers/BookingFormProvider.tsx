import {
  CalendarEvent,
  Department,
  Inputs,
  Resource,
  Role,
  SubmitStatus,
} from "../../types";
import { createContext, useMemo, useState } from "react";

import { DateSelectArg } from "@fullcalendar/core";
import { SAFETY_TRAINING_REQUIRED_ROOM } from "../../policyMediaCommons";
import fetchCalendarEvents from "../routes/booking/hooks/fetchCalendarEvents";
import { useAuth } from "./AuthProvider";
import { usePathname } from "next/navigation";
import { useSharedDatabase } from "./SharedDatabaseProvider";

export interface BookingContextType {
  bookingCalendarInfo: DateSelectArg | undefined;
  department: Department | undefined;
  existingCalendarEvents: CalendarEvent[];
  formData: Inputs | undefined;
  hasShownMocapModal: boolean;
  isBanned: boolean;
  isSafetyTrained: boolean;
  needsSafetyTraining: boolean;
  reloadExistingCalendarEvents: () => void;
  role: Role | undefined;
  selectedRooms: Resource[];
  setBookingCalendarInfo: (x: DateSelectArg) => void;
  setDepartment: (x: Department) => void;
  setFormData: (x: Inputs) => void;
  setHasShownMocapModal: (x: boolean) => void;
  setRole: (x: Role) => void;
  setSelectedRooms: (x: Resource[]) => void;
  setSubmitting: (x: SubmitStatus) => void;
  submitting: SubmitStatus;
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
  reloadExistingCalendarEvents: () => {},
  role: undefined,
  selectedRooms: [],
  setBookingCalendarInfo: (x: DateSelectArg) => {},
  setDepartment: (x: Department) => {},
  setFormData: (x: Inputs) => {},
  setHasShownMocapModal: (x: boolean) => {},
  setRole: (x: Role) => {},
  setSelectedRooms: (x: Resource[]) => {},
  setSubmitting: (x: SubmitStatus) => {},
  submitting: "none",
});

export function BookingFormProvider({ children }) {
  const { bannedUsers, resources, safetyTrainedUsers } = useSharedDatabase();
  const { userEmail } = useAuth();
  const pathname = usePathname();

  const [bookingCalendarInfo, setBookingCalendarInfo] =
    useState<DateSelectArg>();
  const [department, setDepartment] = useState<Department>();
  const [formData, setFormData] = useState<Inputs>(undefined);
  const [hasShownMocapModal, setHasShownMocapModal] = useState(false);
  const [role, setRole] = useState<Role>();
  const [selectedRooms, setSelectedRooms] = useState<Resource[]>([]);
  const [submitting, setSubmitting] = useState<SubmitStatus>("error");
  const { existingCalendarEvents, reloadExistingCalendarEvents } =
    fetchCalendarEvents(resources);

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
      }}
    >
      {children}
    </BookingContext.Provider>
  );
}