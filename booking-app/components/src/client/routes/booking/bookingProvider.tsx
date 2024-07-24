import { Department, Role, RoomSetting } from "../../../types";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { DatabaseContext } from "../components/Provider";
import { DateSelectArg } from "@fullcalendar/core";
import { getOldSafetyTrainingEmails } from "@/components/src/server/db";

export interface BookingContextType {
  bookingCalendarInfo: DateSelectArg | undefined;
  department: Department | undefined;
  isBanned: boolean;
  isSafetyTrained: boolean;
  role: Role | undefined;
  selectedRooms: RoomSetting[];
  setBookingCalendarInfo: (x: DateSelectArg) => void;
  setDepartment: (x: Department) => void;
  setRole: (x: Role) => void;
  setSelectedRooms: (x: RoomSetting[]) => void;
}

export const BookingContext = createContext<BookingContextType>({
  bookingCalendarInfo: undefined,
  department: undefined,
  isBanned: false,
  isSafetyTrained: true,
  role: undefined,
  selectedRooms: [],
  setBookingCalendarInfo: (x: DateSelectArg) => {},
  setDepartment: (x: Department) => {},
  setRole: (x: Role) => {},
  setSelectedRooms: (x: RoomSetting[]) => {},
});

export function BookingProvider({ children }: { children: React.ReactNode }) {
  const { bannedUsers, safetyTrainedUsers, userEmail } =
    useContext(DatabaseContext);

  const [bookingCalendarInfo, setBookingCalendarInfo] =
    useState<DateSelectArg>();
  const [department, setDepartment] = useState<Department>();
  const [isSafetyTrained, setIsSafetyTrained] = useState(true);
  const [role, setRole] = useState<Role>();
  const [selectedRooms, setSelectedRooms] = useState<RoomSetting[]>([]);

  const isBanned = useMemo<boolean>(() => {
    if (!userEmail) return false;
    return bannedUsers
      .map((bannedUser) => bannedUser.email)
      .includes(userEmail);
  }, [userEmail, bannedUsers]);

  const fetchIsSafetyTrained = useCallback(async () => {
    if (!userEmail) return;
    let isTrained = safetyTrainedUsers
      .map((user) => user.email)
      .includes(userEmail);
    setIsSafetyTrained(isTrained);
  }, [userEmail, safetyTrainedUsers]);

  useEffect(() => {
    fetchIsSafetyTrained();
  }, [fetchIsSafetyTrained]);

  useEffect(() => {
    console.log("change Role!");
    console.log(role);
  }, [role]);

  return (
    <BookingContext.Provider
      value={{
        bookingCalendarInfo,
        department,
        isBanned,
        isSafetyTrained,
        role,
        selectedRooms,
        setBookingCalendarInfo,
        setDepartment,
        setRole,
        setSelectedRooms,
      }}
    >
      {children}
    </BookingContext.Provider>
  );
}
export const useBookingContext = () => {
  const context = useContext(BookingContext);
  if (!context) {
    throw new Error("useBookingContext must be used within a BookingProvider");
  }
  return context;
};
