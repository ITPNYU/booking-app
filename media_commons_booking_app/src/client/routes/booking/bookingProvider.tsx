import { Department, Role, RoomSetting } from '../../../types';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { DatabaseContext } from '../components/Provider';
import { DateSelectArg } from '@fullcalendar/core';
import { serverFunctions } from '../../utils/serverFunctions';

export interface BookingContextType {
  bookingCalendarInfo: DateSelectArg | undefined;
  department: Department | undefined;
  isBanned: boolean;
  isSafetyTrained: boolean;
  isStudent: boolean;
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
  isStudent: false,
  isSafetyTrained: true,
  role: undefined,
  selectedRooms: [],
  setBookingCalendarInfo: (x: DateSelectArg) => {},
  setDepartment: (x: Department) => {},
  setRole: (x: Role) => {},
  setSelectedRooms: (x: RoomSetting[]) => {},
});

export function BookingProvider({ children }) {
  const { bannedUsers, safetyTrainedUsers, userEmail } =
    useContext(DatabaseContext);

  const [bookingCalendarInfo, setBookingCalendarInfo] =
    useState<DateSelectArg>();
  const [department, setDepartment] = useState<Department>();
  const [isSafetyTrained, setIsSafetyTrained] = useState(true);
  const [role, setRole] = useState<Role>();
  const [isStudent, setIsStudent] = useState(false);
  const [selectedRooms, setSelectedRooms] = useState<RoomSetting[]>([]);

  const isBanned = useMemo<boolean>(() => {
    console.log('userEmail', userEmail);
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
    console.log('isTrained from tool', isTrained);
    // if not on active list, check old list
    if (!isTrained) {
      isTrained = await serverFunctions
        .getOldSafetyTrainingEmails()
        .then((rows) => rows.map((row) => row[0]).includes(userEmail));
    }
    console.log('isTrained from googlesheets', isTrained);
    setIsSafetyTrained(isTrained);
  }, [userEmail, safetyTrainedUsers]);

  useEffect(() => {
    fetchIsSafetyTrained();
  }, [fetchIsSafetyTrained]);

  useEffect(() => {
    setIsStudent(role === Role.STUDENT);
  }, [role]);

  return (
    <BookingContext.Provider
      value={{
        bookingCalendarInfo,
        department,
        isBanned,
        isSafetyTrained,
        isStudent,
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
