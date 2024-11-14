import {
  AdminUser,
  Approver,
  Ban,
  Booking,
  PagePermission,
  PolicySettings,
  Resource,
  SafetyTraining,
  Settings,
} from "../../types";
import { ApproverLevel, TableNamesRaw } from "@/components/src/policy";
import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { clientFetchAllDataFromCollection } from "@/lib/firebase/firebase";
import { fetchAllFutureBooking } from "@/components/src/server/db";
import { useAuth } from "./AuthProvider";
import useTableName from "../utils/useTableName";

export interface DatabaseContextType {
  adminUsers: AdminUser[];
  approverUsers: Approver[];
  bannedUsers: Ban[];
  bookings: Booking[];
  bookingsLoading: boolean;
  pagePermission: PagePermission;
  policySettings: PolicySettings;
  resources: Resource[];
  safetyTrainedUsers: SafetyTraining[];
  settings: Settings;
  userEmail: string | undefined;
  netId: string | undefined;
  reloadAdminUsers: () => Promise<void>;
  reloadApproverUsers: () => Promise<void>;
  reloadBannedUsers: () => Promise<void>;
  reloadBookings: () => Promise<void>;
  reloadSafetyTrainedUsers: () => Promise<void>;
  overridePagePermission: (x: PagePermission) => void;
}

export const SharedDatabaseContext = createContext<DatabaseContextType>({
  adminUsers: [],
  approverUsers: [],
  bannedUsers: [],
  bookings: [],
  bookingsLoading: true,
  pagePermission: PagePermission.BOOKING,
  policySettings: { finalApproverEmail: "" },
  resources: [],
  safetyTrainedUsers: [],
  settings: { bookingTypes: [] },
  userEmail: undefined,
  netId: undefined,
  reloadAdminUsers: async () => {},
  reloadApproverUsers: async () => {},
  reloadBannedUsers: async () => {},
  reloadBookings: async () => {},
  reloadSafetyTrainedUsers: async () => {},
  overridePagePermission: (x: PagePermission) => {},
});

export const useSharedDatabase = () => useContext(SharedDatabaseContext);

export const SharedDatabaseProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [bannedUsers, setBannedUsers] = useState<Ban[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [bookingsLoading, setBookingsLoading] = useState<boolean>(true);
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [approverUsers, setApproverUsers] = useState<Approver[]>([]);
  const [overriddenPagePermission, setOverriddenPagePermission] =
    useState(null);
  const [policySettings, setPolicySettings] = useState<PolicySettings>({
    finalApproverEmail: "",
  });
  const [resources, setResources] = useState<Resource[]>([]);
  const [safetyTrainedUsers, setSafetyTrainedUsers] = useState<
    SafetyTraining[]
  >([]);
  const tableName = useTableName();
  const { userEmail } = useAuth();
  const [settings, setSettings] = useState<Settings>({ bookingTypes: [] });
  const netId = useMemo(() => userEmail?.split("@")[0], [userEmail]);

  // by default all tenants have permissions BOOKING and ADMIN
  // any other permission levels will be defined in tenant-specific Provider
  // tenants can override this base permission with their own logic
  const basePagePermission = useMemo(() => {
    if (!userEmail) return PagePermission.BOOKING;
    if (adminUsers.map((admin) => admin.email).includes(userEmail))
      return PagePermission.ADMIN;
    else return PagePermission.BOOKING;
  }, [userEmail, adminUsers]);

  const pagePermission = overriddenPagePermission ?? basePagePermission;

  useEffect(() => {
    if (!bookingsLoading) {
      fetchSafetyTrainedUsers();
      fetchBannedUsers();
      fetchApproverUsers();
    } else {
      fetchBookings();
    }
  }, [bookingsLoading, userEmail]);

  useEffect(() => {
    fetchAdminUsers();
    fetchResources();
  }, [userEmail]);

  const fetchBookings = async () => {
    fetchAllFutureBooking(tableName(TableNamesRaw.BOOKING))
      .then((fetchedData) => {
        const bookings = fetchedData.map((item: any) => ({
          id: item.id,
          requestNumber: item.requestNumber,
          calendarEventId: item.calendarEventId,
          email: item.email,
          startDate: item.startDate,
          endDate: item.endDate,
          roomId: String(item.roomId),
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
          otherDepartment: item.otherDepartment,
          role: item.role,
          sponsorFirstName: item.sponsorFirstName,
          sponsorLastName: item.sponsorLastName,
          sponsorEmail: item.sponsorEmail,
          title: item.title,
          description: item.description,
          bookingType: item.bookingType,
          attendeeAffiliation: item.attendeeAffiliation,
          roomSetup: item.roomSetup,
          setupDetails: item.setupDetails,
          mediaServices: item.mediaServices,
          mediaServicesDetails: item.mediaServicesDetails,
          equipmentCheckedOut: item.equipmentCheckedOut,
          catering: item.catering,
          hireSecurity: item.hireSecurity,
          expectedAttendance: item.expectedAttendance,
          cateringService: item.cateringService,
          missingEmail: item?.missingEmail,
          chartFieldForCatering: item.chartFieldForCatering,
          chartFieldForSecurity: item.chartFieldForSecurity,
          chartFieldForRoomSetup: item.chartFieldForRoomSetup,
          requestedAt: item.requestedAt,
          firstApprovedAt: item.firstApprovedAt,
          firstApprovedBy: item.firstApprovedBy,
          finalApprovedAt: item.finalApprovedAt,
          finalApprovedBy: item.finalApprovedBy,
          declinedAt: item.declinedAt,
          declinedBy: item.declinedBy,
          declineReason: item.declineReason,
          canceledAt: item.canceledAt,
          canceledBy: item.canceledBy,
          checkedInAt: item.checkedInAt,
          checkedInBy: item.checkedInBy,
          checkedOutAt: item.checkedOutAt,
          checkedOutBy: item.checkedOutBy,
          noShowedAt: item.noShowedAt,
          noShowedBy: item.noShowedBy,
          walkedInAt: item.walkedInAt,
        }));
        setBookings(bookings);
        setBookingsLoading(false);
      })
      .catch((error) => console.error("Error fetching data:", error));
  };

  const fetchAdminUsers = async () => {
    clientFetchAllDataFromCollection(tableName(TableNamesRaw.ADMINS))
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

  const fetchSafetyTrainedUsers = async () => {
    try {
      // Fetch data from Firestore
      const firestoreData = await clientFetchAllDataFromCollection(
        tableName(TableNamesRaw.SAFETY_TRAINING)
      );
      const firestoreUsers: SafetyTraining[] = firestoreData.map(
        (item: any) => ({
          id: item.id,
          email: item.email,
          completedAt: item.completedAt || new Date().toISOString(), // Use current time if completedAt is missing
        })
      );
      console.log(
        "FETCHED SAFETY TRAINED EMAILS FROM DB:",
        firestoreUsers.length
      );

      // Fetch data from spreadsheet
      const response = await fetch("/api/safety_training_users");
      if (!response.ok) {
        throw new Error("Failed to fetch authorized emails from spreadsheet");
      }
      const spreadsheetData = await response.json();

      console.log(
        "FETCHED SAFETY TRAINED EMAILS FROM SPREADSHEET:",
        spreadsheetData.emails.length
      );
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
      console.log("TOTAL UNIQUE SAFETY TRAINED USER:", uniqueUsers.length);
      // Update state
      setSafetyTrainedUsers(uniqueUsers);
    } catch (error) {
      console.error("Error fetching safety trained users:", error);
      throw error;
    }
  };

  const fetchBannedUsers = async () => {
    clientFetchAllDataFromCollection(tableName(TableNamesRaw.BANNED))
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

  const fetchApproverUsers = async () => {
    clientFetchAllDataFromCollection(tableName(TableNamesRaw.APPROVERS))
      .then((fetchedData) => {
        const all = fetchedData.map((item: any) => ({
          id: item.id,
          email: item.email,
          department: item.department,
          createdAt: item.createdAt,
          level: Number(item.level),
        }));
        const approvers = all.filter((x) => x.level === ApproverLevel.FIRST);
        const finalApprover = all.filter(
          (x) => x.level === ApproverLevel.FINAL
        )[0];
        setApproverUsers(approvers);
        setPolicySettings({ finalApproverEmail: finalApprover.email });
      })
      .catch((error) => console.error("Error fetching data:", error));
  };

  const fetchResources = async () => {
    clientFetchAllDataFromCollection(tableName(TableNamesRaw.RESOURCES))
      .then((fetchedData) => {
        const filtered = fetchedData.map((item: any) => ({
          id: item.id,
          roomId: item.roomId,
          name: item.name,
          capacity: item.capacity,
          calendarId: item.calendarId,
        }));
        filtered.sort((a, b) => a.roomId - b.roomId);
        setResources(filtered);
      })
      .catch((error) => console.error("Error fetching data:", error));
  };

  return (
    <SharedDatabaseContext.Provider
      value={{
        adminUsers,
        approverUsers,
        bannedUsers,
        bookings,
        pagePermission,
        policySettings,
        resources,
        safetyTrainedUsers,
        settings,
        userEmail,
        netId,
        bookingsLoading,
        reloadAdminUsers: fetchAdminUsers,
        reloadApproverUsers: fetchApproverUsers,
        reloadBannedUsers: fetchBannedUsers,
        reloadBookings: fetchBookings,
        reloadSafetyTrainedUsers: fetchSafetyTrainedUsers,
        overridePagePermission: setOverriddenPagePermission,
      }}
    >
      {children}
    </SharedDatabaseContext.Provider>
  );
};
