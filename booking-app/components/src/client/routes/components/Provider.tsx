import { DEFAULT_TENANT } from "@/components/src/constants/tenants";
import { ApproverLevel, TableNames } from "@/components/src/policy";
import React, { createContext, useEffect, useMemo, useState } from "react";
import {
  AdminUser,
  Approver,
  Ban,
  BlackoutPeriod,
  Booking,
  BookingType,
  DepartmentType,
  Filters,
  OperationHours,
  PaUser,
  PagePermission,
  PolicySettings,
  PreBanLog,
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
import { useContext } from "react";
import { SchemaContext } from "./SchemaProvider";

export interface DatabaseContextType {
  adminUsers: AdminUser[];
  bannedUsers: Ban[];
  blackoutPeriods: BlackoutPeriod[];
  allBookings: Booking[];
  bookingsLoading: boolean;
  liaisonUsers: Approver[];
  equipmentUsers: Approver[];
  departmentNames: DepartmentType[];
  operationHours: OperationHours[];
  pagePermission: PagePermission;
  paUsers: PaUser[];
  superAdminUsers: AdminUser[];
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
  reloadBlackoutPeriods: () => Promise<void>;
  reloadFutureBookings: () => Promise<void>;
  reloadDepartmentNames: () => Promise<void>;
  reloadOperationHours: () => Promise<void>;
  reloadPaUsers: () => Promise<void>;
  reloadBookingTypes: () => Promise<void>;
  reloadSafetyTrainedUsers: () => Promise<void>;
  reloadPolicySettings: () => Promise<void>;
  setUserEmail: (x: string) => void;
  fetchAllBookings: (clicked: boolean) => Promise<void>;
  setFilters: (x: Filters) => void;
  setLoadMoreEnabled: (x: boolean) => void;
  setLastItem: (x: any) => void;
  preBanLogs: PreBanLog[];
  reloadPreBanLogs: () => Promise<void>;
  reloadSuperAdminUsers: () => Promise<void>;
}

export const DatabaseContext = createContext<DatabaseContextType>({
  adminUsers: [],
  bannedUsers: [],
  blackoutPeriods: [],
  allBookings: [],
  bookingsLoading: true,
  liaisonUsers: [],
  equipmentUsers: [],
  departmentNames: [],
  operationHours: [],
  pagePermission: PagePermission.BOOKING,
  paUsers: [],
  superAdminUsers: [],
  policySettings: { finalApproverEmail: "" },
  roomSettings: [],
  safetyTrainedUsers: [],
  settings: { bookingTypes: [] },
  userEmail: undefined,
  netId: undefined,
  userApiData: undefined,
  loadMoreEnabled: true,
  reloadAdminUsers: async () => {},
  reloadApproverUsers: async () => {},
  reloadBannedUsers: async () => {},
  reloadBlackoutPeriods: async () => {},
  reloadFutureBookings: async () => {},
  reloadDepartmentNames: async () => {},
  reloadOperationHours: async () => {},
  reloadPaUsers: async () => {},
  reloadBookingTypes: async () => {},
  reloadSafetyTrainedUsers: async () => {},
  reloadPolicySettings: async () => {},
  setUserEmail: (x: string) => {},
  fetchAllBookings: async () => {},
  setFilters: (x: Filters) => {},
  setLoadMoreEnabled: (x: boolean) => {},
  setLastItem: (x: any) => {},
  preBanLogs: [],
  reloadPreBanLogs: async () => {},
  reloadSuperAdminUsers: async () => {},
});

export const DatabaseProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [bannedUsers, setBannedUsers] = useState<Ban[]>([]);
  const [blackoutPeriods, setBlackoutPeriods] = useState<BlackoutPeriod[]>([]);
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
  const [filters, setFilters] = useState<Filters>({
    dateRange: "",
    sortField: "startDate",
  });
  const LIMIT = 10;

  const { user } = useAuth();
  const netId = useMemo(() => userEmail?.split("@")[0], [userEmail]);

  // Get tenant from SchemaContext
  const schemaContext = useContext(SchemaContext);
  const tenant = schemaContext?.tenant;

  const [preBanLogs, setPreBanLogs] = useState<PreBanLog[]>([]);
  const [superAdminUsers, setSuperAdminUsers] = useState<AdminUser[]>([]);

  useEffect(() => {
    const fetchUserApiData = async () => {
      if (!netId || !tenant) return;
      try {
        const response = await fetch(`/api/nyu/identity/${netId}`, {
          headers: {
            "x-tenant": tenant || DEFAULT_TENANT,
          },
        });
        if (response.ok) {
          const data = await response.json();
          setUserApiData(data);
        }
      } catch (err) {
        console.error("Failed to fetch user data:", err);
      }
    };
    fetchUserApiData();
  }, [netId, tenant]);

  // page permission updates with respect to user email, admin list, PA list
  const pagePermission = useMemo<PagePermission>(() => {
    // Early return if no email
    if (!userEmail) return PagePermission.BOOKING;

    // Pre-compute email lists once
    const adminEmails = adminUsers.map((admin) => admin.email);
    const liaisonEmails = liaisonUsers.map((liaison) => liaison.email);
    const paEmails = paUsers.map((pa) => pa.email);
    const equipmentEmails = equipmentUsers.map((e) => e.email);
    const superAdminEmails = superAdminUsers.map((admin) => admin.email);

    // Check permissions (ordered by hierarchy - highest to lowest)
    if (superAdminEmails.includes(userEmail)) return PagePermission.SUPER_ADMIN;
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
    JSON.stringify(superAdminUsers),
  ]);

  useEffect(() => {
    console.log(allBookings.length);
  }, [allBookings]);

  useEffect(() => {
    if (!bookingsLoading && tenant) {
      fetchSafetyTrainedUsers();
      fetchBannedUsers();
      fetchApproverUsers();
      fetchDepartmentNames();
      fetchSettings();
    } else {
      // fetchBookings();
    }
  }, [bookingsLoading, user, tenant]);

  useEffect(() => {
    fetchBookings();
  }, [filters]);

  useEffect(() => {
    fetchActiveUserEmail();
    if (tenant) {
      fetchAdminUsers();
      fetchPaUsers();
      fetchSuperAdminUsers();
    }
  }, [user, tenant]);

  useEffect(() => {
    if (tenant) {
      fetchRoomSettings();
    }
  }, [tenant]);

  const fetchActiveUserEmail = () => {
    if (!user) return;
    setUserEmail(user.email);
  };

  const fetchFutureBookings = async () => {
    try {
      setBookingsLoading(true);
      const fetchedData = await fetchAllFutureBooking();
      setAllBookings(fetchedData as Booking[]);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setBookingsLoading(false);
    }
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
        lastItem,
        tenant
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
    clientFetchAllDataFromCollection(TableNames.ADMINS, [], tenant)
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
    clientFetchAllDataFromCollection(TableNames.PAS, [], tenant)
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
        TableNames.SAFETY_TRAINING,
        [],
        tenant
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
      const response = await fetch("/api/safety_training_users", {
        headers: {
          "x-tenant": tenant || DEFAULT_TENANT,
        },
      });
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
          userMap.set(email, {
            id: email,
            email,
            completedAt: currentDate,
          });
        }
      });

      // Convert map back to array
      const mergedUsers = Array.from(userMap.values());
      setSafetyTrainedUsers(mergedUsers);
    } catch (error) {
      console.error("Error fetching safety trained users:", error);
    }
  };

  const fetchBannedUsers = async () => {
    clientFetchAllDataFromCollection(TableNames.BANNED, [], tenant)
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
    clientFetchAllDataFromCollection(TableNames.APPROVERS, [], tenant)
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
    clientFetchAllDataFromCollection(TableNames.DEPARTMENTS, [], tenant)
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
    if (!tenant) {
      console.warn("fetchRoomSettings called but tenant is not available yet");
      return;
    }

    try {
      console.log(`fetchRoomSettings called with tenant: "${tenant}"`);
      // Get tenant schema from the API
      const url = `/api/tenantSchema/${tenant}`;
      console.log(`Fetching from URL: ${url}`);
      const response = await fetch(url);
      if (!response.ok) {
        console.error(
          `Failed to fetch tenant schema. Status: ${response.status}, URL: ${url}`
        );
        throw new Error("Failed to fetch tenant schema");
      }
      const schema = await response.json();

      // Convert schema resources to RoomSetting format
      const filtered = schema.resources.map((resource: any) => ({
        id: resource.roomId.toString(), // Use roomId as id
        roomId: resource.roomId,
        name: resource.name,
        capacity: resource.capacity.toString(),
        calendarId: resource.calendarId,
      }));

      filtered.sort((a, b) => a.roomId - b.roomId);
      setRoomSettings(filtered);
    } catch (error) {
      console.error("Error fetching room settings from schema:", error);
    }
  };

  const fetchBookingTypes = async () => {
    clientFetchAllDataFromCollection(TableNames.BOOKING_TYPES, [], tenant)
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
    clientFetchAllDataFromCollection(TableNames.OPERATION_HOURS, [], tenant)
      .then((fetchedData) => {
        setOperationHours(fetchedData as OperationHours[]);
      })
      .catch((error) => console.error("Error fetching data:", error));
  };

  const fetchBlackoutPeriods = async () => {
    try {
      const fetchedData =
        await clientFetchAllDataFromCollection<BlackoutPeriod>(
          TableNames.BLACKOUT_PERIODS,
          [],
          tenant
        );
      setBlackoutPeriods(
        fetchedData.sort(
          (a, b) =>
            a.startDate.toDate().getTime() - b.startDate.toDate().getTime()
        )
      );
    } catch (error) {
      console.error("Error fetching blackout periods:", error);
    }
  };

  const fetchPolicySettings = async () => {
    // This function is kept for future policy settings but currently not fetching booking date limits
    // since we're using blackout periods instead
  };

  const fetchSettings = async () => {
    fetchBookingTypes();
    fetchOperationHours();
    fetchBlackoutPeriods();
  };

  const fetchPreBanLogs = async () => {
    try {
      const fetchedData = await clientFetchAllDataFromCollection(
        TableNames.PRE_BAN_LOGS,
        [],
        tenant
      );
      const logs = fetchedData.map((item: any) => ({
        id: item.id,
        bookingId: item.bookingId,
        netId: item.netId,
        lateCancelDate: item.lateCancelDate,
        noShowDate: item.noShowDate,
      }));
      setPreBanLogs(logs);
    } catch (error) {
      console.error("Error fetching pre-ban logs:", error);
    }
  };

  const fetchSuperAdminUsers = async () => {
    clientFetchAllDataFromCollection(TableNames.SUPER_ADMINS, [], tenant)
      .then((fetchedData) => {
        const superAdminUsers = fetchedData.map((item: any) => ({
          id: item.id,
          email: item.email,
          createdAt: item.createdAt,
        }));
        setSuperAdminUsers(superAdminUsers);
      })
      .catch((error) =>
        console.error("Error fetching super admin data:", error)
      );
  };

  return (
    <DatabaseContext.Provider
      value={{
        adminUsers,
        bannedUsers,
        blackoutPeriods,
        allBookings,
        liaisonUsers,
        equipmentUsers,
        departmentNames,
        operationHours,
        paUsers,
        superAdminUsers,
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
        reloadBlackoutPeriods: fetchBlackoutPeriods,
        reloadFutureBookings: fetchFutureBookings,
        reloadDepartmentNames: fetchDepartmentNames,
        reloadOperationHours: fetchOperationHours,
        reloadPaUsers: fetchPaUsers,
        reloadBookingTypes: fetchBookingTypes,
        reloadSafetyTrainedUsers: fetchSafetyTrainedUsers,
        reloadPolicySettings: fetchPolicySettings,
        setUserEmail,
        fetchAllBookings: fetchBookings,
        setFilters: setFilters,
        setLoadMoreEnabled,
        setLastItem,
        preBanLogs,
        reloadPreBanLogs: fetchPreBanLogs,
        reloadSuperAdminUsers: fetchSuperAdminUsers,
      }}
    >
      {children}
    </DatabaseContext.Provider>
  );
};
