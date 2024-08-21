import {
  AdminUser,
  Ban,
  Booking,
  BookingStatus,
  DepartmentType,
  LiaisonType,
  PaUser,
  PagePermission,
  PolicySettings,
  ReservationType,
  RoomSetting,
  SafetyTraining,
  Settings,
} from "../../../types";
import React, { createContext, useEffect, useMemo, useState } from "react";
import {
  fetchAllFutureBooking,
  fetchAllFutureBookingStatus,
} from "@/components/src/server/db";

import { TableNames } from "@/components/src/policy";
import { fetchAllDataFromCollection } from "@/lib/firebase/firebase";
import { useAuth } from "@/components/src/client/routes/components/AuthProvider";

export interface DatabaseContextType {
  adminUsers: AdminUser[];
  bannedUsers: Ban[];
  bookings: Booking[];
  bookingsLoading: boolean;
  bookingStatuses: BookingStatus[];
  liaisonUsers: LiaisonType[];
  departmentNames: DepartmentType[];
  pagePermission: PagePermission;
  paUsers: PaUser[];
  policySettings: PolicySettings;
  roomSettings: RoomSetting[];
  safetyTrainedUsers: SafetyTraining[];
  settings: Settings;
  userEmail: string | undefined;
  reloadAdminUsers: () => Promise<void>;
  reloadBannedUsers: () => Promise<void>;
  reloadBookings: () => Promise<void>;
  reloadBookingStatuses: () => Promise<void>;
  reloadLiaisonUsers: () => Promise<void>;
  reloadDepartmentNames: () => Promise<void>;
  reloadPaUsers: () => Promise<void>;
  reloadPolicySettings: () => Promise<void>;
  reloadReservationTypes: () => Promise<void>;
  reloadSafetyTrainedUsers: () => Promise<void>;
  setUserEmail: (x: string) => void;
}

export const DatabaseContext = createContext<DatabaseContextType>({
  adminUsers: [],
  bannedUsers: [],
  bookings: [],
  bookingsLoading: true,
  bookingStatuses: [],
  liaisonUsers: [],
  departmentNames: [],
  pagePermission: PagePermission.BOOKING,
  paUsers: [],
  policySettings: { finalApproverEmail: "" },
  roomSettings: [],
  safetyTrainedUsers: [],
  settings: { reservationTypes: [] },
  userEmail: undefined,
  reloadAdminUsers: async () => {},
  reloadBannedUsers: async () => {},
  reloadBookings: async () => {},
  reloadBookingStatuses: async () => {},
  reloadLiaisonUsers: async () => {},
  reloadDepartmentNames: async () => {},
  reloadPaUsers: async () => {},
  reloadPolicySettings: async () => {},
  reloadReservationTypes: async () => {},
  reloadSafetyTrainedUsers: async () => {},
  setUserEmail: (x: string) => {},
});

export const DatabaseProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [bannedUsers, setBannedUsers] = useState<Ban[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [bookingsLoading, setBookingsLoading] = useState<boolean>(true);
  const [bookingStatuses, setBookingStatuses] = useState<BookingStatus[]>([]);
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [liaisonUsers, setLiaisonUsers] = useState<LiaisonType[]>([]);
  const [departmentNames, setDepartmentName] = useState<DepartmentType[]>([]);
  const [paUsers, setPaUsers] = useState<PaUser[]>([]);
  const [policySettings, setPolicySettings] = useState<PolicySettings>({
    finalApproverEmail: "",
  });
  const [roomSettings, setRoomSettings] = useState<RoomSetting[]>([]);
  const [safetyTrainedUsers, setSafetyTrainedUsers] = useState<
    SafetyTraining[]
  >([]);
  const [settings, setSettings] = useState<Settings>({ reservationTypes: [] });
  const [userEmail, setUserEmail] = useState<string | undefined>();
  const { user } = useAuth();

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
    if (!bookingsLoading) {
      fetchSafetyTrainedUsers();
      fetchBannedUsers();
      fetchLiaisonUsers();
      fetchDepartmentNames();
      fetchRoomSettings();
      fetchSettings();
    } else {
      fetchBookings();
      fetchBookingStatuses();
    }
  }, [bookingsLoading, user]);

  useEffect(() => {
    fetchActiveUserEmail();
    fetchAdminUsers();
    fetchPaUsers();
  }, [user]);

  const fetchActiveUserEmail = () => {
    if (!user) return;
    setUserEmail(user.email);
  };

  const fetchBookings = async () => {
    fetchAllFutureBooking(TableNames.BOOKING)
      .then((fetchedData) => {
        const bookings = fetchedData.map((item: any) => ({
          id: item.id,
          requestNumber: item.requestNumber,
          calendarEventId: item.calendarEventId,
          email: item.email,
          startDate: item.startDate,
          endDate: item.endDate,
          roomId: item.roomId,
          user: item.user,
          room: item.room,
          startTime: item.startTime,
          endTime: item.endTime,
          status: item.status,
          firstName: item.firstName,
          lastName: item.lastName,
          secondaryName: item.secondaryName,
          nNumber: item.nNumber,
          netId: item.netId,
          phoneNumber: item.phoneNumber,
          department: item.department,
          role: item.role,
          sponsorFirstName: item.sponsorFirstName,
          sponsorLastName: item.sponsorLastName,
          sponsorEmail: item.sponsorEmail,
          title: item.title,
          description: item.description,
          reservationType: item.reservationType,
          attendeeAffiliation: item.attendeeAffiliation,
          roomSetup: item.roomSetup,
          setupDetails: item.setupDetails,
          mediaServices: item.mediaServices,
          mediaServicesDetails: item.mediaServicesDetails,
          catering: item.catering,
          hireSecurity: item.hireSecurity,
          expectedAttendance: item.expectedAttendance,
          cateringService: item.cateringService,
          missingEmail: item?.missingEmail,
          chartFieldForCatering: item.chartFieldForCatering,
          chartFieldForSecurity: item.chartFieldForSecurity,
          chartFieldForRoomSetup: item.chartFieldForRoomSetup,
        }));
        setBookings(bookings);
        setBookingsLoading(false);
      })
      .catch((error) => console.error("Error fetching data:", error));
  };

  const fetchBookingStatuses = async () => {
    fetchAllFutureBookingStatus(TableNames.BOOKING_STATUS)
      .then((fetchedData) => {
        const filtered = fetchedData.map((item: any) => ({
          id: item.id,
          calendarEventId: item.calendarEventId,
          email: item.email,
          requestedAt: item.requestedAt,
          firstApprovedAt: item.firstApprovedAt,
          secondApprovedAt: item.secondApprovedAt,
          declinedAt: item.declinedAt,
          canceledAt: item.canceledAt,
          checkedInAt: item.checkedInAt,
          checkedOutAt: item.checkedOutAt,
          noShowedAt: item.noShowedAt,
          walkedInAt: item.walkedInAt,
        }));
        setBookingStatuses(filtered);
      })
      .catch((error) => console.error("Error fetching data:", error));
  };

  const fetchAdminUsers = async () => {
    fetchAllDataFromCollection(TableNames.ADMINS)
      .then((fetchedData) => {
        const adminUsers = fetchedData.map((item: any) => ({
          id: item.id,
          email: item.email,
          createdAt: item.createdAt,
        }));
        setAdminUsers(adminUsers);
      })
      .catch((error) => console.error("Error fetching data:", error));
  };

  const fetchPaUsers = async () => {
    fetchAllDataFromCollection(TableNames.PAS)
      .then((fetchedData) => {
        const paUsers = fetchedData.map((item: any) => ({
          id: item.id,
          email: item.email,
          createdAt: item.createdAt,
        }));
        setPaUsers(paUsers);
      })
      .catch((error) => console.error("Error fetching data:", error));
  };

  const fetchSafetyTrainedUsers = async () => {
    try {
      // Fetch data from Firestore
      const firestoreData = await fetchAllDataFromCollection(
        TableNames.SAFETY_TRAINING
      );
      const firestoreUsers: SafetyTraining[] = firestoreData.map(
        (item: any) => ({
          id: item.id,
          email: item.email,
          completedAt: item.completedAt || new Date().toISOString(), // Use current time if completedAt is missing
        })
      );

      // Fetch data from spreadsheet
      const response = await fetch("/api/safety_training_users");
      if (!response.ok) {
        throw new Error("Failed to fetch authorized emails from spreadsheet");
      }
      const spreadsheetData = await response.json();
      const currentDate = new Date().toISOString();

      // Map to merge users
      const userMap = new Map<string, SafetyTraining>();

      // Add Firestore users to the map
      firestoreUsers.forEach((user) => {
        userMap.set(user.email, user);
      });

      // Add or update spreadsheet users
      spreadsheetData.emails.forEach((email: string) => {
        if (!userMap.has(email)) {
          userMap.set(email, { email, id: null, completedAt: currentDate });
        }
      });

      // Convert Map to SafetyTraining array
      const uniqueUsers = Array.from(userMap.values());
      // Update state
      setSafetyTrainedUsers(uniqueUsers);
    } catch (error) {
      console.error("Error fetching safety trained users:", error);
      throw error;
    }
  };

  const fetchBannedUsers = async () => {
    fetchAllDataFromCollection(TableNames.BANNED)
      .then((fetchedData) => {
        const filtered = fetchedData.map((item: any) => ({
          id: item.id,
          email: item.email,
          bannedAt: item.createdAt,
        }));
        setBannedUsers(filtered);
      })
      .catch((error) => console.error("Error fetching data:", error));
  };

  const fetchLiaisonUsers = async () => {
    fetchAllDataFromCollection(TableNames.LIAISONS_PROD)
      .then((fetchedData) => {
        const filtered = fetchedData.map((item: any) => ({
          id: item.id,
          email: item.email,
          department: item.department,
          createdAt: item.createdAt,
        }));
        setLiaisonUsers(filtered);
      })
      .catch((error) => console.error("Error fetching data:", error));
  };
  const fetchDepartmentNames = async () => {
    fetchAllDataFromCollection(TableNames.DEPARTMENTS)
      .then((fetchedData) => {
        const filtered = fetchedData.map((item: any) => ({
          id: item.id,
          department: item.department,
          createdAt: item.createdAt,
          departmentTier: item.departmentTier,
        }));
        setDepartmentName(filtered);
      })
      .catch((error) => console.error("Error fetching data:", error));
  };

  const fetchRoomSettings = async () => {
    fetchAllDataFromCollection(TableNames.ROOMS)
      .then((fetchedData) => {
        const filtered = fetchedData.map((item: any) => ({
          id: item.id,
          roomId: item.roomId,
          name: item.name,
          capacity: item.capacity,
          calendarId: item.calendarId,
        }));
        filtered.sort((a, b) => a.roomId - b.roomId);
        setRoomSettings(filtered);
      })
      .catch((error) => console.error("Error fetching data:", error));
  };

  const fetchBookingReservationTypes = async () => {
    fetchAllDataFromCollection(TableNames.RESERVATION_TYPES)
      .then((fetchedData) => {
        const filtered = fetchedData.map((item: any) => ({
          id: item.id,
          reservationType: item.reservationType,
          createdAt: item.createdAt,
        }));
        setSettings((prev) => ({
          ...prev,
          reservationTypes: filtered as ReservationType[],
        }));
      })
      .catch((error) => console.error("Error fetching data:", error));
  };

  const fetchPolicySettings = async () => {
    fetchAllDataFromCollection(TableNames.POLICY)
      .then((fetchedData) => {
        const policy: PolicySettings = fetchedData.map((item: any) => ({
          finalApproverEmail: item.finalApproverEmail,
        }))[0]; // should only be 1 document
        setPolicySettings(policy);
      })
      .catch((error) =>
        console.error("Error fetching policy settings data:", error)
      );
  };

  const fetchSettings = async () => {
    fetchBookingReservationTypes();
    fetchPolicySettings();
  };

  return (
    <DatabaseContext.Provider
      value={{
        adminUsers,
        bannedUsers,
        bookings,
        bookingStatuses,
        liaisonUsers,
        departmentNames,
        paUsers,
        pagePermission,
        policySettings,
        roomSettings,
        safetyTrainedUsers,
        settings,
        userEmail,
        bookingsLoading,
        reloadAdminUsers: fetchAdminUsers,
        reloadBannedUsers: fetchBannedUsers,
        reloadBookings: fetchBookings,
        reloadBookingStatuses: fetchBookingStatuses,
        reloadLiaisonUsers: fetchLiaisonUsers,
        reloadDepartmentNames: fetchDepartmentNames,
        reloadPaUsers: fetchPaUsers,
        reloadPolicySettings: fetchPolicySettings,
        reloadReservationTypes: fetchBookingReservationTypes,
        reloadSafetyTrainedUsers: fetchSafetyTrainedUsers,
        setUserEmail,
      }}
    >
      {children}
    </DatabaseContext.Provider>
  );
};
