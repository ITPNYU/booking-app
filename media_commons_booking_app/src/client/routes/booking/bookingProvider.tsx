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
import { SAFETY_TRAINING_REQUIRED_ROOM } from '../../../policy';

export interface BookingContextType {
  bookingCalendarInfo: DateSelectArg | undefined;
  department: Department | undefined;
  isBanned: boolean;
  isSafetyTrained: boolean;
  needsSafetyTraining: boolean;
  role: Role | undefined;
  selectedRooms: RoomSetting[];
  setBookingCalendarInfo: (x: DateSelectArg) => void;
  setDepartment: (x: Department) => void;
  setRole: (x: Role) => void;
  setSelectedRooms: (x: RoomSetting[]) => void;
  checkSafetyTraining: (x: String[]) => void;
}

export const BookingContext = createContext<BookingContextType>({
  bookingCalendarInfo: undefined,
  department: undefined,
  isBanned: false,
  needsSafetyTraining: false,
  isSafetyTrained: true,
  role: undefined,
  selectedRooms: [],
  setBookingCalendarInfo: (x: DateSelectArg) => {},
  setDepartment: (x: Department) => {},
  setRole: (x: Role) => {},
  setSelectedRooms: (x: RoomSetting[]) => {},
  checkSafetyTraining: (x: any) => {},
});

export function BookingProvider({ children }) {
  const { bannedUsers, safetyTrainedUsers, userEmail } =
    useContext(DatabaseContext);

  const [bookingCalendarInfo, setBookingCalendarInfo] =
    useState<DateSelectArg>();
  const [department, setDepartment] = useState<Department>();
  const [isSafetyTrained, setIsSafetyTrained] = useState(true);
  const [role, setRole] = useState<Role>();
  const [needsSafetyTraining, setNeedsSafetyTraining] = useState(false);
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

  const checkSafetyTraining = (roomIds = []) => {
    const isStudent = role === Role.STUDENT;
    const requiresSafetyTraining = roomIds.some((id) =>
      SAFETY_TRAINING_REQUIRED_ROOM.includes(id)
    );
    setNeedsSafetyTraining(
      isStudent && !isSafetyTrained && requiresSafetyTraining
    );
  };

  return (
    <BookingContext.Provider
      value={{
        bookingCalendarInfo,
        department,
        isBanned,
        isSafetyTrained,
        needsSafetyTraining,
        role,
        selectedRooms,
        setBookingCalendarInfo,
        setDepartment,
        setRole,
        setSelectedRooms,
        checkSafetyTraining,
      }}
    >
      {children}
    </BookingContext.Provider>
  );
}
