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
  canBookFullTime: boolean;
  department: Department | undefined;
  isBanned: boolean;
  isSafetyTrained: boolean;
  isThesis_PLACEHOLDER: boolean;
  role: Role | undefined;
  selectedRooms: RoomSetting[];
  setBookingCalendarInfo: (x: DateSelectArg) => void;
  setDepartment: (x: Department) => void;
  setIsThesis: (x: boolean) => void;
  setRole: (x: Role) => void;
  setSelectedRooms: (x: RoomSetting[]) => void;
}

export const BookingContext = createContext<BookingContextType>({
  bookingCalendarInfo: undefined,
  canBookFullTime: false,
  department: undefined,
  isBanned: false,
  isSafetyTrained: true,
  isThesis_PLACEHOLDER: false,
  role: undefined,
  selectedRooms: [],
  setBookingCalendarInfo: (x: DateSelectArg) => {},
  setDepartment: (x: Department) => {},
  setIsThesis: (x: boolean) => {},
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
  const [isThesis_PLACEHOLDER, setIsThesis] = useState(false);
  const [role, setRole] = useState<Role>();
  const [selectedRooms, setSelectedRooms] = useState<RoomSetting[]>([]);

  const canBookFullTime = useMemo(
    () => isThesis_PLACEHOLDER || role !== 'Student',
    [isThesis_PLACEHOLDER, role]
  );

  const isBanned = useMemo<boolean>(() => {
    if (!userEmail) return false;
    return bannedUsers
      .map((bannedUser) => bannedUser.email)
      .includes(userEmail);
  }, [userEmail, bannedUsers]);

  useEffect(() => {
    fetchIsSafetyTrained();
  }, []);

  const fetchIsSafetyTrained = useCallback(async () => {
    if (!userEmail) return;
    let isTrained = safetyTrainedUsers
      .map((user) => user.email)
      .includes(userEmail);
    // if not on active list, check old list
    if (!isTrained) {
      isTrained = await serverFunctions
        .getOldSafetyTrainingEmails()
        .then((rows) => rows.map((row) => row[0]).includes(userEmail));
    }
    setIsSafetyTrained(isTrained);
  }, [userEmail, safetyTrainedUsers]);

  return (
    <BookingContext.Provider
      value={{
        bookingCalendarInfo,
        canBookFullTime,
        department,
        isBanned,
        isSafetyTrained,
        isThesis_PLACEHOLDER,
        role,
        selectedRooms,
        setBookingCalendarInfo,
        setDepartment,
        setIsThesis,
        setRole,
        setSelectedRooms,
      }}
    >
      {children}
    </BookingContext.Provider>
  );
}
