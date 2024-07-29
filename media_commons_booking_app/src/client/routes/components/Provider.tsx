import {
  AdminUser,
  Ban,
  Booking,
  BookingStatus,
  LiaisonType,
  PaUser,
  PagePermission,
  ReservationType,
  RoomSetting,
  SafetyTraining,
  Settings,
} from '../../../types';
import React, { createContext, useEffect, useMemo, useState } from 'react';
import { TableNames, getLiaisonTableName } from '../../../policy';

import { serverFunctions } from '../../utils/serverFunctions';
import useFakeDataLocalStorage from '../../utils/useFakeDataLocalStorage';

export interface DatabaseContextType {
  adminUsers: AdminUser[];
  bannedUsers: Ban[];
  bookings: Booking[];
  bookingStatuses: BookingStatus[];
  liaisonUsers: LiaisonType[];
  pagePermission: PagePermission;
  paUsers: PaUser[];
  roomSettings: RoomSetting[];
  safetyTrainedUsers: SafetyTraining[];
  settings: Settings;
  userEmail: string | undefined;
  reloadAdminUsers: () => Promise<void>;
  reloadBannedUsers: () => Promise<void>;
  reloadBookings: () => Promise<void>;
  reloadBookingStatuses: () => Promise<void>;
  reloadLiaisonUsers: () => Promise<void>;
  reloadPaUsers: () => Promise<void>;
  reloadReservationTypes: () => Promise<void>;
  reloadSafetyTrainedUsers: () => Promise<void>;
  setUserEmail: (x: string) => void;
}

export const DatabaseContext = createContext<DatabaseContextType>({
  adminUsers: [],
  bannedUsers: [],
  bookings: [],
  bookingStatuses: [],
  liaisonUsers: [],
  pagePermission: PagePermission.BOOKING,
  paUsers: [],
  roomSettings: [],
  safetyTrainedUsers: [],
  settings: { reservationTypes: [] },
  userEmail: undefined,
  reloadAdminUsers: async () => {},
  reloadBannedUsers: async () => {},
  reloadBookings: async () => {},
  reloadBookingStatuses: async () => {},
  reloadLiaisonUsers: async () => {},
  reloadPaUsers: async () => {},
  reloadReservationTypes: async () => {},
  reloadSafetyTrainedUsers: async () => {},
  setUserEmail: (x: string) => {},
});

export const DatabaseProvider = ({ children }) => {
  const [bannedUsers, setBannedUsers] = useState<Ban[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [bookingStatuses, setBookingStatuses] = useState<BookingStatus[]>([]);
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [liaisonUsers, setLiaisonUsers] = useState<LiaisonType[]>([]);
  const [paUsers, setPaUsers] = useState<PaUser[]>([]);
  const [roomSettings, setRoomSettings] = useState<RoomSetting[]>([]);
  const [safetyTrainedUsers, setSafetyTrainedUsers] = useState<
    SafetyTraining[]
  >([]);
  const [settings, setSettings] = useState<Settings>({ reservationTypes: [] });
  const [userEmail, setUserEmail] = useState<string | undefined>();

  // page permission updates with respect to user email, admin list, PA list
  const pagePermission = useMemo<PagePermission>(() => {
    if (!userEmail) return PagePermission.BOOKING;

    if (adminUsers.map((admin) => admin.email).includes(userEmail))
      return PagePermission.ADMIN;
    else if (paUsers.map((pa) => pa.email).includes(userEmail))
      return PagePermission.PA;
    else return PagePermission.BOOKING;
  }, [userEmail, adminUsers, paUsers]);

  useFakeDataLocalStorage(setBookings, setBookingStatuses);

  useEffect(() => {
    // fetch most important tables first - determine page permissions
    Promise.all([
      fetchActiveUserEmail(),
      fetchAdminUsers(),
      fetchPaUsers(),
    ]).then(() => {
      fetchBookings();
      fetchBookingStatuses();
      fetchSafetyTrainedUsers();
      fetchBannedUsers();
      fetchLiaisonUsers();
      fetchRoomSettings();
      fetchSettings();
    });

    // refresh booking data every 10s;
    setInterval(() => {
      fetchBookings();
      fetchBookingStatuses();
    }, 10000);
  }, []);

  const fetchActiveUserEmail = () => {
    serverFunctions.getActiveUserEmail().then((response) => {
      setUserEmail(response);
    });
  };

  const fetchBookings = async () => {
    const bookingRows = await serverFunctions
      .getActiveBookingsFutureDates()
      .then((rows) => {
        return (JSON.parse(rows) as Booking[]).filter((booking) => {
          return booking.devBranch === process.env.BRANCH_NAME;
        });
      });
    setBookings((prev) => {
      const existingIds = prev.map((row) => row.calendarEventId);
      const toAdd = bookingRows.filter(
        (row) => !existingIds.includes(row.calendarEventId)
      );
      return [...toAdd, ...prev];
    });
  };

  const fetchBookingStatuses = async () => {
    const bookingStatusRows = await serverFunctions
      .getAllActiveSheetRows(TableNames.BOOKING_STATUS)
      .then((rows) => JSON.parse(rows) as BookingStatus[]);
    setBookingStatuses((prev) => {
      const existingIds = prev.map((row) => row.calendarEventId);
      const toAdd = bookingStatusRows.filter(
        (row) => !existingIds.includes(row.calendarEventId)
      );
      return [...toAdd, ...prev];
    });
  };

  const fetchAdminUsers = async () => {
    const admins = await serverFunctions
      .getAllActiveSheetRows(TableNames.ADMINS)
      .then((rows) => JSON.parse(rows) as AdminUser[]);
    setAdminUsers(admins);
  };

  const fetchPaUsers = async () => {
    const pas = await serverFunctions
      .getAllActiveSheetRows(TableNames.PAS)
      .then((rows) => JSON.parse(rows) as PaUser[]);
    setPaUsers(pas);
  };

  const fetchSafetyTrainedUsers = async () => {
    const trained = await serverFunctions
      .getAllActiveSheetRows(TableNames.SAFETY_TRAINING)
      .then((rows) => JSON.parse(rows) as SafetyTraining[]);
    setSafetyTrainedUsers(trained);
  };

  const fetchBannedUsers = async () => {
    const banned = await serverFunctions
      .getAllActiveSheetRows(TableNames.BANNED)
      .then((rows) => JSON.parse(rows) as Ban[]);
    setBannedUsers(banned);
  };

  const fetchLiaisonUsers = async () => {
    const liaisons = await serverFunctions
      .getAllActiveSheetRows(getLiaisonTableName())
      .then((rows) => JSON.parse(rows) as LiaisonType[]);
    setLiaisonUsers(liaisons);
  };

  const fetchRoomSettings = async () => {
    const settings = await serverFunctions
      .getAllActiveSheetRows(TableNames.ROOMS)
      .then((rows) => {
        return JSON.parse(rows) as RoomSetting[];
      });
    setRoomSettings(settings);
  };

  const fetchBookingReservationTypes = async () => {
    const reservationTypes: ReservationType[] = await serverFunctions
      .getAllActiveSheetRows(TableNames.RESERVATION_TYPES)
      .then((rows) => JSON.parse(rows));
    setSettings((prev) => ({
      ...prev,
      reservationTypes,
    }));
  };

  const fetchSettings = async () => {
    await fetchBookingReservationTypes();
  };

  return (
    <DatabaseContext.Provider
      value={{
        adminUsers,
        bannedUsers,
        bookings,
        bookingStatuses,
        liaisonUsers,
        paUsers,
        pagePermission,
        roomSettings,
        safetyTrainedUsers,
        settings,
        userEmail,
        reloadAdminUsers: fetchAdminUsers,
        reloadBannedUsers: fetchBannedUsers,
        reloadBookings: fetchBookings,
        reloadBookingStatuses: fetchBookingStatuses,
        reloadLiaisonUsers: fetchLiaisonUsers,
        reloadPaUsers: fetchPaUsers,
        reloadReservationTypes: fetchBookingReservationTypes,
        reloadSafetyTrainedUsers: fetchSafetyTrainedUsers,
        setUserEmail,
      }}
    >
      {children}
    </DatabaseContext.Provider>
  );
};
