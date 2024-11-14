import {
  AdminUser,
  Approver,
  Ban,
  PagePermission,
  PolicySettings,
  Resource,
  SafetyTraining,
  Settings,
} from "../../types";
import { ApproverLevel, TableNamesRaw } from "@/components/src/policy";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { clientFetchAllDataFromCollection } from "@/lib/firebase/firebase";
import { useAuth } from "./AuthProvider";
import useTableName from "../utils/useTableName";

export interface DatabaseContextType {
  adminUsers: AdminUser[];
  approverUsers: Approver[];
  bannedUsers: Ban[];
  bookingsLoading: boolean;
  pagePermission: PagePermission;
  policySettings: PolicySettings;
  resources: Resource[];
  safetyTrainedUsers: SafetyTraining[];
  settings: Settings;
  userEmail: string | undefined;
  reloadAdminUsers: () => Promise<void>;
  reloadApproverUsers: () => Promise<void>;
  reloadBannedUsers: () => Promise<void>;
  reloadBookings: () => Promise<void>;
  reloadSafetyTrainedUsers: () => Promise<void>;
  overridePagePermission: (x: PagePermission) => void;
  setBookingsLoading: (x: boolean) => void;
  setFetchBookings: React.Dispatch<React.SetStateAction<() => Promise<void>>>;
}

export const SharedDatabaseContext = createContext<DatabaseContextType>({
  adminUsers: [],
  approverUsers: [],
  bannedUsers: [],
  bookingsLoading: true,
  pagePermission: PagePermission.BOOKING,
  policySettings: { finalApproverEmail: "" },
  resources: [],
  safetyTrainedUsers: [],
  settings: { bookingTypes: [] },
  userEmail: undefined,
  reloadAdminUsers: async () => {},
  reloadApproverUsers: async () => {},
  reloadBannedUsers: async () => {},
  reloadBookings: async () => {},
  reloadSafetyTrainedUsers: async () => {},
  overridePagePermission: (x: PagePermission) => {},
  setBookingsLoading: (x: boolean) => {},
  setFetchBookings: () => async () => {},
});

export const useSharedDatabase = () => useContext(SharedDatabaseContext);

export const SharedDatabaseProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [bannedUsers, setBannedUsers] = useState<Ban[]>([]);
  const [bookingsLoading, setBookingsLoading] = useState<boolean>(true);
  const [fetchBookings, setFetchBookings] = useState<() => Promise<void>>();
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
    }
  }, [bookingsLoading, userEmail]);

  useEffect(() => {
    fetchAdminUsers();
    fetchResources();
  }, [userEmail]);

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

  const reloadBookings = useCallback(async () => {
    if (fetchBookings) {
      fetchBookings();
    }
  }, [fetchBookings]);

  return (
    <SharedDatabaseContext.Provider
      value={{
        adminUsers,
        approverUsers,
        bannedUsers,
        pagePermission,
        policySettings,
        resources,
        safetyTrainedUsers,
        settings,
        userEmail,
        bookingsLoading,
        reloadAdminUsers: fetchAdminUsers,
        reloadApproverUsers: fetchApproverUsers,
        reloadBannedUsers: fetchBannedUsers,
        reloadBookings,
        reloadSafetyTrainedUsers: fetchSafetyTrainedUsers,
        overridePagePermission: setOverriddenPagePermission,
        setBookingsLoading,
        setFetchBookings,
      }}
    >
      {children}
    </SharedDatabaseContext.Provider>
  );
};
