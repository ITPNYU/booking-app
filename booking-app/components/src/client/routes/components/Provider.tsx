import { ApproverLevel, TableNames } from "@/components/src/policy";
import React, { createContext, useEffect, useMemo, useState } from "react";
import {
  AdminUser,
  Approver,
  Ban,
  Booking,
  BookingType,
  DepartmentType,
  Filters,
  OperationHours,
  PaUser,
  PagePermission,
  PolicySettings,
  RoomSetting,
  SafetyTraining,
  Settings,
  UserApiData,
} from "../../../types";

import { useAuth } from "@/components/src/client/routes/components/AuthProvider";
import {
  fetchAllBookings,
  fetchAllFutureBooking,
} from "@/components/src/server/db";
import { clientFetchAllDataFromCollection } from "@/lib/firebase/firebase";
import { Timestamp } from "firebase-admin/firestore";

export interface DatabaseContextType {
  adminUsers: AdminUser[];
  bannedUsers: Ban[];
  allBookings: Booking[];
  bookingsLoading: boolean;
  liaisonUsers: Approver[];
  equipmentUsers: Approver[];
  departmentNames: DepartmentType[];
  operationHours: OperationHours[];
  pagePermission: PagePermission;
  paUsers: PaUser[];
  policySettings: PolicySettings;
  roomSettings: RoomSetting[];
  safetyTrainedUsers: SafetyTraining[];
  settings: Settings;
  userEmail: string | undefined;
  netId: string | undefined;
  userApiData: UserApiData | undefined;
  loadMoreEnabled?: boolean;
  reloadAdminUsers: () => Promise<void>;
  reloadApproverUsers: () => Promise<void>;
  reloadBannedUsers: () => Promise<void>;
  reloadFutureBookings: () => Promise<void>;
  reloadDepartmentNames: () => Promise<void>;
  reloadOperationHours: () => Promise<void>;
  reloadPaUsers: () => Promise<void>;
  reloadBookingTypes: () => Promise<void>;
  reloadSafetyTrainedUsers: () => Promise<void>;
  setUserEmail: (x: string) => void;
  fetchAllBookings: (clicked: boolean) => Promise<void>;
  setFilters: (x: Filters) => void;
  setLoadMoreEnabled: (x: boolean) => void;
  setLastItem: (x: any) => void;
}

export const DatabaseContext = createContext<DatabaseContextType>({
  adminUsers: [],
  bannedUsers: [],
  allBookings: [],
  bookingsLoading: true,
  liaisonUsers: [],
  equipmentUsers: [],
  departmentNames: [],
  operationHours: [],
  pagePermission: PagePermission.BOOKING,
  paUsers: [],
  policySettings: { finalApproverEmail: "" },
  roomSettings: [],
  safetyTrainedUsers: [],
  settings: { bookingTypes: [] },
  userEmail: undefined,
  netId: undefined,
  userApiData: undefined,
  loadMoreEnabled: true,
  reloadAdminUsers: async () => { },
  reloadApproverUsers: async () => { },
  reloadBannedUsers: async () => { },
  reloadFutureBookings: async () => { },
  reloadDepartmentNames: async () => { },
  reloadOperationHours: async () => { },
  reloadPaUsers: async () => { },
  reloadBookingTypes: async () => { },
  reloadSafetyTrainedUsers: async () => { },
  setUserEmail: (x: string) => { },
  fetchAllBookings: async () => { },
  setFilters: (x: Filters) => { },
  setLoadMoreEnabled: (x: boolean) => { },
  setLastItem: (x: any) => { },
});

export const DatabaseProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [bannedUsers, setBannedUsers] = useState<Ban[]>([]);
  // const [futureBookings, setFutureBookings] = useState<Booking[]>([]);
  const [bookingsLoading, setBookingsLoading] = useState<boolean>(true);
  const [allBookings, setAllBookings] = useState<Booking[]>([]);
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [liaisonUsers, setLiaisonUsers] = useState<Approver[]>([]);
  const [equipmentUsers, setEquipmentUsers] = useState<Approver[]>([]);
  const [departmentNames, setDepartmentName] = useState<DepartmentType[]>([]);
  const [operationHours, setOperationHours] = useState<OperationHours[]>([]);
  const [paUsers, setPaUsers] = useState<PaUser[]>([]);
  const [policySettings, setPolicySettings] = useState<PolicySettings>({
    finalApproverEmail: "",
  });
  const [loadMoreEnabled, setLoadMoreEnabled] = useState<boolean>(true);

  const [roomSettings, setRoomSettings] = useState<RoomSetting[]>([]);
  const [safetyTrainedUsers, setSafetyTrainedUsers] = useState<
    SafetyTraining[]
  >([]);
  const [settings, setSettings] = useState<Settings>({ bookingTypes: [] });
  const [userEmail, setUserEmail] = useState<string | undefined>();
  const [userApiData, setUserApiData] = useState<UserApiData | undefined>(
    undefined
  );
  const [lastItem, setLastItem] = useState<any>(null);
  const [filters, setFilters] = useState<Filters>({ dateRange: "", sortField: "startDate" });
  const LIMIT = 10;

  const { user } = useAuth();
  const netId = useMemo(() => userEmail?.split("@")[0], [userEmail]);

  useEffect(() => {
    const fetchUserApiData = async () => {
      if (!netId) return;
      try {
        const response = await fetch(`/api/nyu/identity/${netId}`);
        if (response.ok) {
          const data = await response.json();
          setUserApiData(data);
        }
      } catch (err) {
        console.error("Failed to fetch user data:", err);
      }
    };
    fetchUserApiData();
  }, [netId]);

  // page permission updates with respect to user email, admin list, PA list
  const pagePermission = useMemo<PagePermission>(() => {
    // Early return if no email
    if (!userEmail) return PagePermission.BOOKING;

    // Pre-compute email lists once
    const adminEmails = adminUsers.map((admin) => admin.email);
    const liaisonEmails = liaisonUsers.map((liaison) => liaison.email);
    const paEmails = paUsers.map((pa) => pa.email);
    const equipmentEmails = equipmentUsers.map((e) => e.email);

    // Check permissions
    if (adminEmails.includes(userEmail)) return PagePermission.ADMIN;
    if (equipmentEmails.includes(userEmail)) return PagePermission.EQUIPMENT;
    if (liaisonEmails.includes(userEmail)) return PagePermission.LIAISON;
    if (paEmails.includes(userEmail)) return PagePermission.PA;

    return PagePermission.BOOKING;
  }, [
    userEmail,
    // Make sure we're using the actual arrays in dependencies
    JSON.stringify(adminUsers),
    JSON.stringify(liaisonUsers),
    JSON.stringify(paUsers),
    JSON.stringify(equipmentUsers),
  ]);

  useEffect(() => {
    console.log(allBookings.length);
  }, [allBookings]);

  useEffect(() => {
    if (!bookingsLoading) {
      fetchSafetyTrainedUsers();
      fetchBannedUsers();
      fetchApproverUsers();
      fetchDepartmentNames();
      fetchSettings();
    } else {
      // fetchBookings();
    }
  }, [bookingsLoading, user]);

  useEffect(() => {
    fetchBookings();
  }, [filters]);

  useEffect(() => {
    fetchActiveUserEmail();
    fetchAdminUsers();
    fetchPaUsers();
    fetchRoomSettings();
  }, [user]);

  const fetchActiveUserEmail = () => {
    if (!user) return;
    setUserEmail(user.email);
  };

  const fetchFutureBookings = async () => {
    fetchAllFutureBooking()
      .then((fetchedData) => {
        // setFutureBookings(fetchedData as Booking[]);
        setBookingsLoading(false);
      })
      .catch((error) => console.error("Error fetching data:", error));
  };

  const fetchBookings = async (clicked = false): Promise<void> => {
    try {
      
      if (filters.dateRange === "") {
        return Promise.resolve();
      }
      
      const bookingsResponse: Booking[] = await fetchAllBookings(
        pagePermission,
        LIMIT,
        filters,
        lastItem
      );

      if (clicked && bookingsResponse.length === 0) {
        setLoadMoreEnabled(false);
        return Promise.resolve();
      }

      if (clicked) {
        setLastItem(bookingsResponse[bookingsResponse.length - 1]);
        setAllBookings((oldBookings) => [...oldBookings, ...bookingsResponse]);
      } else {
        setLastItem(bookingsResponse[bookingsResponse.length - 1]);
        setAllBookings(bookingsResponse);
      }

      return Promise.resolve();
    } catch (error) {
      console.error("Error fetching data:", error);
      return Promise.reject(error);
    } finally {
      setBookingsLoading(false);
    }
  };

  const fetchAdminUsers = async () => {
    clientFetchAllDataFromCollection(TableNames.ADMINS)
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
    clientFetchAllDataFromCollection(TableNames.PAS)
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
      const firestoreData = await clientFetchAllDataFromCollection(
        TableNames.SAFETY_TRAINING
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
    clientFetchAllDataFromCollection(TableNames.BANNED)
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
    clientFetchAllDataFromCollection(TableNames.APPROVERS)
      .then((fetchedData) => {
        const all = fetchedData.map((item: any) => ({
          id: item.id,
          email: item.email,
          department: item.department,
          createdAt: item.createdAt,
          level: Number(item.level),
        }));
        const liaisons = all.filter((x) => x.level === ApproverLevel.FIRST);
        const equipmentUsers = all.filter(
          (x) => x.level === ApproverLevel.EQUIPMENT
        );

        const finalApprover = all.filter(
          (x) => x.level === ApproverLevel.FINAL
        )[0];
        setLiaisonUsers(liaisons);
        setEquipmentUsers(equipmentUsers);
        setPolicySettings({ finalApproverEmail: finalApprover.email });
      })
      .catch((error) => console.error("Error fetching data:", error));
  };

  const fetchDepartmentNames = async () => {
    clientFetchAllDataFromCollection(TableNames.DEPARTMENTS)
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
    clientFetchAllDataFromCollection(TableNames.RESOURCES)
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

  const fetchBookingTypes = async () => {
    clientFetchAllDataFromCollection(TableNames.BOOKING_TYPES)
      .then((fetchedData) => {
        const filtered = fetchedData.map((item: any) => ({
          id: item.id,
          bookingType: item.bookingType,
          createdAt: item.createdAt,
        }));
        setSettings((prev) => ({
          ...prev,
          bookingTypes: filtered as BookingType[],
        }));
      })
      .catch((error) => console.error("Error fetching data:", error));
  };

  const fetchOperationHours = async () => {
    clientFetchAllDataFromCollection(TableNames.OPERATION_HOURS)
      .then((fetchedData) => {
        setOperationHours(fetchedData as OperationHours[]);
      })
      .catch((error) => console.error("Error fetching data:", error));
  };

  // const fetchPolicySettings = async () => {
  //   clientFetchAllDataFromCollection(TableNames.POLICY)
  //     .then((fetchedData) => {
  //       const policy: PolicySettings = fetchedData.map((item: any) => ({
  //         finalApproverEmail: item.finalApproverEmail,
  //       }))[0]; // should only be 1 document
  //       setPolicySettings(policy);
  //     })
  //     .catch((error) =>
  //       console.error("Error fetching policy settings data:", error)
  //     );
  // };

  const fetchSettings = async () => {
    fetchBookingTypes();
    fetchOperationHours();
  };

  return (
    <DatabaseContext.Provider
      value={{
        adminUsers,
        bannedUsers,
        allBookings,
        liaisonUsers,
        equipmentUsers,
        departmentNames,
        operationHours,
        paUsers,
        pagePermission,
        policySettings,
        roomSettings,
        safetyTrainedUsers,
        settings,
        userEmail,
        netId,
        bookingsLoading,
        userApiData,
        loadMoreEnabled,
        reloadAdminUsers: fetchAdminUsers,
        reloadApproverUsers: fetchApproverUsers,
        reloadBannedUsers: fetchBannedUsers,
        reloadFutureBookings: fetchFutureBookings,
        reloadDepartmentNames: fetchDepartmentNames,
        reloadOperationHours: fetchOperationHours,
        reloadPaUsers: fetchPaUsers,
        reloadBookingTypes: fetchBookingTypes,
        reloadSafetyTrainedUsers: fetchSafetyTrainedUsers,
        setUserEmail,
        fetchAllBookings: fetchBookings,
        setFilters: setFilters,
        setLoadMoreEnabled,
        setLastItem,
      }}
    >
      {children}
    </DatabaseContext.Provider>
  );
};
