import {
  AdminUser,
  Ban,
  Booking,
  BookingStatus,
  DevBranch,
  LiaisonType,
  PaUser,
  PagePermission,
  RoomSetting,
  SafetyTraining,
} from '../../../types';
import React, { createContext, useEffect, useMemo, useState } from 'react';

import { TableNames } from '../../../policy';
import { serverFunctions } from '../../utils/serverFunctions';

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
  userEmail: string | undefined;
  reloadAdminUsers: () => Promise<void>;
  reloadBannedUsers: () => Promise<void>;
  reloadBookings: () => Promise<void>;
  reloadBookingStatuses: () => Promise<void>;
  reloadLiaisonUsers: () => Promise<void>;
  reloadPaUsers: () => Promise<void>;
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
  userEmail: undefined,
  reloadAdminUsers: async () => {},
  reloadBannedUsers: async () => {},
  reloadBookings: async () => {},
  reloadBookingStatuses: async () => {},
  reloadLiaisonUsers: async () => {},
  reloadPaUsers: async () => {},
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
    });
  }, []);

  const fetchActiveUserEmail = () => {
    serverFunctions.getActiveUserEmail().then((response) => {
      console.log('userEmail:', response);
      setUserEmail(response);
    });
  };

  const fetchBookings = async () => {
    console.log('CURRENT BRANCH:', process.env.BRANCH_NAME);
    const bookingRows = await serverFunctions
      .getActiveBookingsFutureDates()
      .then((rows) =>
        rows
          .map((row) => mappingBookingRows(row))
          .filter((booking) => booking.devBranch === process.env.BRANCH_NAME)
      );
    setBookings(bookingRows);
  };

  const fetchBookingStatuses = async () => {
    const bookingStatusRows = await serverFunctions
      .getAllActiveSheetRows(TableNames.BOOKING_STATUS)
      .then((rows) => rows.map((row) => mappingBookingStatusRow(row)));
    setBookingStatuses(bookingStatusRows);
  };

  const fetchAdminUsers = async () => {
    const admins = await serverFunctions
      .getAllActiveSheetRows(TableNames.ADMINS)
      .then((rows) =>
        rows.map((row) => ({
          email: row[0],
          createdAt: row[1],
        }))
      );
    setAdminUsers(admins);
  };

  const fetchPaUsers = async () => {
    const pas = await serverFunctions
      .getAllActiveSheetRows(TableNames.PAS)
      .then((rows) =>
        rows.map((row) => ({
          email: row[0],
          createdAt: row[1],
        }))
      );
    setPaUsers(pas);
  };

  const fetchSafetyTrainedUsers = async () => {
    const trained = await serverFunctions
      .getAllActiveSheetRows(TableNames.SAFETY_TRAINING)
      .then((rows) =>
        rows.map((row) => ({
          email: row[0],
          completedAt: row[1],
        }))
      );
    setSafetyTrainedUsers(trained);
  };

  const fetchBannedUsers = async () => {
    const banned = await serverFunctions
      .getAllActiveSheetRows(TableNames.BANNED)
      .then((rows) =>
        rows.map((row) => ({
          email: row[0],
          bannedAt: row[1],
        }))
      );
    setBannedUsers(banned);
  };

  const fetchLiaisonUsers = async () => {
    const liaisons = await serverFunctions
      .getAllActiveSheetRows(TableNames.LIAISONS)
      .then((rows) =>
        rows.map((row) => ({
          email: row[0],
          department: row[1],
          createdAt: row[2],
        }))
      );
    setLiaisonUsers(liaisons);
  };

  const fetchRoomSettings = async () => {
    const settings = await serverFunctions
      .getAllActiveSheetRows(TableNames.ROOMS)
      .then((rows) =>
        rows.map((roomRow) => ({
          roomId: roomRow[0],
          name: roomRow[1],
          capacity: roomRow[2],
          calendarId: roomRow[3],
          calendarIdProd: roomRow[4],
        }))
      );
    setRoomSettings(settings);
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
        userEmail,
        reloadAdminUsers: fetchAdminUsers,
        reloadBannedUsers: fetchBannedUsers,
        reloadBookings: fetchBookings,
        reloadBookingStatuses: fetchBookingStatuses,
        reloadLiaisonUsers: fetchLiaisonUsers,
        reloadPaUsers: fetchPaUsers,
        reloadSafetyTrainedUsers: fetchSafetyTrainedUsers,
        setUserEmail,
      }}
    >
      {children}
    </DatabaseContext.Provider>
  );
};

const mappingBookingRows = (values: string[]): Booking => {
  return {
    calendarEventId: values[0],
    roomId: values[1],
    email: values[2],
    startDate: values[3],
    endDate: values[4],
    firstName: values[5],
    lastName: values[6],
    secondaryName: values[7],
    nNumber: values[8],
    netId: values[9],
    phoneNumber: values[10],
    department: values[11],
    role: values[12],
    sponsorFirstName: values[13],
    sponsorLastName: values[14],
    sponsorEmail: values[15],
    reservationTitle: values[16],
    reservationDescription: values[17],
    expectedAttendance: values[18],
    attendeeAffiliation: values[19],
    roomSetup: values[20],
    setupDetails: values[21],
    mediaServices: values[22],
    mediaServicesDetails: values[23],
    catering: values[24],
    cateringService: values[25],
    hireSecurity: values[26],
    chartFieldForCatering: values[27],
    chartFieldForSecurity: values[28],
    chartFieldForRoomSetup: values[29],
    devBranch: values[30] as DevBranch,
  };
};

const mappingBookingStatusRow = (values: string[]): BookingStatus => {
  return {
    calendarEventId: values[0],
    email: values[1],
    requestedAt: values[2],
    firstApprovedAt: values[3],
    secondApprovedAt: values[4],
    rejectedAt: values[5],
    canceledAt: values[6],
    checkedInAt: values[7],
  };
};
