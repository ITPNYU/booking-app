import { getApiHeaders } from "@/components/src/client/utils/apiHeaders";
import { ApproverLevel, TableNames } from "@/components/src/policy";
import React, {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
  useContext,
} from "react";
import { usePathname } from "next/navigation";

import { useAuth } from "@/components/src/client/routes/components/AuthProvider";
import {
  fetchAllBookings,
  fetchAllFutureBooking,
} from "@/components/src/server/db";
import {
  clientFetchAllDataFromCollection,
  reviveTimestamps,
} from "@/lib/firebase/firebase";
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
import { SchemaContext } from "./SchemaProvider";
import {
  applyE2EMockAdminUsers,
  applyE2EMockApprovers,
  applyE2EMockBookings,
  applyE2EMockPaUsers,
  applyE2EMockSafetyUsers,
} from "./e2eMockUtils";

export interface DatabaseContextType {
  adminUsers: AdminUser[];
  bannedUsers: Ban[];
  blackoutPeriods: BlackoutPeriod[];
  allBookings: Booking[];
  bookingsLoading: boolean;
  permissionsLoading: boolean;
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
  reloadSafetyTrainedUsers: (
    rooms?: Array<{ roomId: string; trainingFormUrl?: string }>,
  ) => Promise<void>;
  reloadPolicySettings: () => Promise<void>;
  setUserEmail: (x: string) => void;
  fetchAllBookings: (clicked: boolean) => Promise<void>;
  updateBookingInList: (
    calendarEventId: string,
    updatedFields: Partial<Booking>
  ) => void;
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
  permissionsLoading: true,
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
  updateBookingInList: () => {},
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
  const [permissionsLoading, setPermissionsLoading] = useState<boolean>(true);
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
    undefined,
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
          headers: getApiHeaders(tenant),
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
    const servicesEmails = equipmentUsers.map((e) => e.email);
    const superAdminEmails = superAdminUsers.map((admin) => admin.email);

    // Check permissions (ordered by hierarchy - highest to lowest)
    if (superAdminEmails.includes(userEmail)) return PagePermission.SUPER_ADMIN;
    if (adminEmails.includes(userEmail)) return PagePermission.ADMIN;
    if (servicesEmails.includes(userEmail)) return PagePermission.SERVICES;
    if (liaisonEmails.includes(userEmail)) return PagePermission.LIAISON;
    if (paEmails.includes(userEmail)) return PagePermission.PA;

    return PagePermission.BOOKING;
  }, [userEmail, adminUsers, liaisonUsers, paUsers, equipmentUsers, superAdminUsers]);


  // Defer non-permission data fetches to pages that actually need them.
  // The landing page only needs permissions; booking/admin data loads on navigation.
  const pathname = usePathname();
  const needsBookingData = useMemo(() => {
    if (!pathname) return false;
    const segments = pathname.split("/").filter(Boolean);
    // e.g. /mc/book, /mc/edit, /mc/admin, /mc/walk-in, /mc/vip, /mc/services, /mc/pa, /mc/liaison, /mc/modification
    const dataRoutes = ["book", "edit", "admin", "walk-in", "vip", "services", "pa", "liaison", "modification"];
    return segments.some((s) => dataRoutes.includes(s));
  }, [pathname]);

  useEffect(() => {
    if (!bookingsLoading && tenant && needsBookingData) {
      fetchBannedUsers();
      fetchDepartmentNames();
      fetchSettings();
    }
  }, [bookingsLoading, tenant, needsBookingData]);

  useEffect(() => {
    fetchBookings();
  }, [filters]);

  useEffect(() => {
    const loadPermissions = async () => {
      if (tenant) {
        // Only show the blocking loading state on the first resolution.
        // NextAuth's `useSession()` re-fetches on window focus, which gives
        // `user` a new object reference even when the user hasn't changed;
        // flipping `permissionsLoading` back to `true` on every focus made
        // `[tenant]/page.tsx` blank the screen for the duration of the new
        // round-trip (white flash on tab return).
        const isFirstLoad =
          adminUsers.length === 0 &&
          superAdminUsers.length === 0 &&
          liaisonUsers.length === 0 &&
          equipmentUsers.length === 0 &&
          paUsers.length === 0;
        if (isFirstLoad) {
          setPermissionsLoading(true);
        }
        try {
          // Set user email synchronously so pagePermission is correct
          // when we mark loading as done.
          fetchActiveUserEmail();
          // Single round-trip: usersRights + usersSuperAdmin + usersApprovers
          // are fetched and joined server-side. Replaces three parallel
          // /api/firestore/list calls with one /api/permissions GET.
          await fetchPermissions();
        } finally {
          // Only mark done once we actually have a user email.  If auth hasn't
          // resolved yet (user === null) keep the loading state so the redirect
          // logic in NavBar doesn't fire prematurely with pagePermission=BOOKING.
          if (user) {
            setPermissionsLoading(false);
          }
        }
      } else {
        setPermissionsLoading(false);
      }
    };
    loadPermissions();
    // Depend on `user?.email` (a stable primitive) instead of the `user`
    // object so a NextAuth focus refetch doesn't retrigger this effect.
  }, [user?.email, tenant]);

  // Derive roomSettings from SchemaContext instead of re-fetching from API
  useEffect(() => {
    if (schemaContext?.resources && Array.isArray(schemaContext.resources)) {
      const rooms: RoomSetting[] = schemaContext.resources
        .map((resource) => ({
          ...resource,
          capacity: String(resource.capacity),
          needsSafetyTraining: resource.needsSafetyTraining || false,
          isWalkIn: resource.isWalkIn || false,
          isWalkInCanBookTwo: resource.isWalkInCanBookTwo || false,
          isEquipment: resource.isEquipment || false,
          services: resource.services || [],
        }))
        .sort((a, b) => a.roomId - b.roomId);
      setRoomSettings(rooms);
    }
  }, [schemaContext?.resources]);

  const fetchActiveUserEmail = () => {
    if (!user) return;
    setUserEmail(user.email);
  };

  const fetchFutureBookings = async () => {
    try {
      setBookingsLoading(true);
      if (
        applyE2EMockBookings({
          setAllBookings,
        })
      ) {
        return;
      }
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
      if (
        applyE2EMockBookings({
          setAllBookings,
          resetPagination: () => setLastItem(null),
        })
      ) {
        return Promise.resolve();
      }

      if (filters.dateRange === "") {
        return Promise.resolve();
      }

      const bookingsResponse: Booking[] = await fetchAllBookings(
        pagePermission,
        LIMIT,
        filters,
        lastItem,
        tenant,
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

  // Single round-trip permission load. Replaces the old fan-out of
  // fetchUsersRights + fetchSuperAdminUsers + fetchApproverUsers (three
  // /api/firestore/list calls) with one /api/permissions request that
  // joins everything server-side.
  const fetchPermissions = async () => {
    // E2E test path: short-circuit if window.__bookingE2EMocks holds
    // any of the relevant collections, matching the legacy behaviour.
    const adminMocked = applyE2EMockAdminUsers(setAdminUsers);
    const paMocked = applyE2EMockPaUsers(setPaUsers);
    const approverMocked = applyE2EMockApprovers({
      setLiaisonUsers,
      setEquipmentUsers,
      setPolicySettings,
    });
    if (adminMocked || paMocked || approverMocked) {
      return;
    }

    try {
      const url = tenant
        ? `/api/permissions?tenant=${encodeURIComponent(tenant)}`
        : "/api/permissions";
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`/api/permissions failed: ${res.status}`);
      }
      const raw = (await res.json()) as Record<string, unknown>;
      const data = reviveTimestamps(raw) as {
        adminUsers: AdminUser[];
        paUsers: PaUser[];
        liaisonUsers: Approver[];
        equipmentUsers: Approver[];
        superAdminUsers: AdminUser[];
        policySettings: PolicySettings;
      };
      setAdminUsers(data.adminUsers ?? []);
      setPaUsers(data.paUsers ?? []);
      setLiaisonUsers(data.liaisonUsers ?? []);
      setEquipmentUsers(data.equipmentUsers ?? []);
      setSuperAdminUsers(data.superAdminUsers ?? []);
      setPolicySettings(
        data.policySettings ?? { finalApproverEmail: "" },
      );
    } catch (error) {
      console.error("Error fetching permissions:", error);
      // Don't blow away whatever was already in state; just leave it stale.
      // The caller can decide to retry.
    }
  };

  const updateBookingInList = (
    calendarEventId: string,
    updatedFields: Partial<Booking>,
  ): void => {
    setAllBookings((prev) =>
      prev.map((b) =>
        b.calendarEventId === calendarEventId ? { ...b, ...updatedFields } : b,
      ),
    );
  };

  // Individual reload functions (used by admin pages after add/delete).
  // Delegate to the unified fetchPermissions so we don't re-read the same
  // usersRights collection three times for one user action.
  const fetchAdminUsers = fetchPermissions;
  const fetchPaUsers = fetchPermissions;

  const fetchSafetyTrainedUsers = useCallback(
    async (rooms?: Array<{ roomId: string; trainingFormUrl?: string }>) => {
      try {
        if (applyE2EMockSafetyUsers(setSafetyTrainedUsers)) {
          return;
        }

        // Fetch data from Firestore
        const firestoreData = await clientFetchAllDataFromCollection(
          TableNames.SAFETY_TRAINING,
          [],
          tenant,
        );
        const firestoreUsers: SafetyTraining[] = firestoreData.map(
          (item: any) => ({
            id: item.id,
            email: item.email,
            completedAt: item.completedAt || new Date().toISOString(), // Use current time if completedAt is missing
          }),
        );
        // Map to merge users from all sources
        const userMap = new Map<string, SafetyTraining>();

        // Add Firestore users to the map
        firestoreUsers.forEach((user) => {
          userMap.set(user.email, user);
        });

        // Fetch from Google Forms for each room that has a trainingFormUrl
        if (rooms && rooms.length > 0) {
          const roomsWithFormUrl = rooms.filter((room) => room.trainingFormUrl);

          if (roomsWithFormUrl.length > 0) {
            // Fetch from all rooms and merge results
            const formPromises = roomsWithFormUrl.map(async (room) => {
              try {
                const headers = getApiHeaders(tenant, {
                  "x-resource-id": room.roomId,
                });

                const response = await fetch("/api/safety_training_form", {
                  headers,
                });

                if (!response.ok) {
                  return []; // Return empty array on error for this room
                }

                const formData = await response.json();
                return formData.emails || [];
              } catch (error: any) {
                console.error(
                  `Error fetching form data for room ${room.roomId}:`,
                  error,
                );
                return []; // Return empty array on error for this room
              }
            });

            // Wait for all form requests to complete
            const allFormEmails = await Promise.all(formPromises);
            const currentDate = new Date().toISOString();

            // Merge all form response emails into the map
            allFormEmails.flat().forEach((email: string) => {
              if (email && email.includes("@") && !userMap.has(email)) {
                userMap.set(email, {
                  id: email,
                  email,
                  completedAt: currentDate,
                });
              }
            });

          }
        } else {
          // No rooms provided, fetch all (no resource filter)
          try {
            const response = await fetch("/api/safety_training_form", {
              headers: getApiHeaders(tenant),
            });

            if (response.ok) {
              const formData = await response.json();
              const currentDate = new Date().toISOString();

              formData.emails?.forEach((email: string) => {
                if (email && email.includes("@") && !userMap.has(email)) {
                  userMap.set(email, {
                    id: email,
                    email,
                    completedAt: currentDate,
                  });
                }
              });

            }
          } catch (error: any) {
            console.error(
              "Error fetching all safety trained users from form:",
              error,
            );
          }
        }

        // Convert map back to array
        const mergedUsers = Array.from(userMap.values());
        setSafetyTrainedUsers(mergedUsers);
      } catch (error: any) {
        console.error("Error fetching safety trained users:", error);

        // Use Firestore data as fallback if available
        if (error?.response) {
          const responseData = await error.response.json();
          console.error("API Error:", responseData.error);
        }

        // Set safety trained users to empty array on error
        setSafetyTrainedUsers([]);
      }
    },
    [tenant],
  );

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

  // Approver / liaison reload now goes through the unified endpoint.
  const fetchApproverUsers = fetchPermissions;

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

  const fetchBookingTypes = async () => {
    clientFetchAllDataFromCollection(TableNames.BOOKING_TYPES, [], tenant)
      .then((fetchedData) => {
        const filtered = fetchedData.map((item: any) => ({
          id: item.id,
          bookingType: item.bookingType,
          createdAt: item.createdAt,
        }));

        // If no booking types are available, add a default "Other" option
        const bookingTypes =
          filtered.length > 0
            ? filtered
            : [
                {
                  id: "default-other",
                  bookingType: "Other",
                  createdAt: new Date().toISOString(),
                },
              ];

        setSettings((prev) => ({
          ...prev,
          bookingTypes: bookingTypes as BookingType[],
        }));
      })
      .catch((error) => {
        console.error("Error fetching data:", error);
        // On error, also provide a default "Other" option
        setSettings((prev) => ({
          ...prev,
          bookingTypes: [
            {
              id: "default-other",
              bookingType: "Other",
              createdAt: new Date().toISOString(),
            },
          ] as BookingType[],
        }));
      });
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
          tenant,
        );
      setBlackoutPeriods(
        fetchedData.sort(
          (a, b) =>
            a.startDate.toDate().getTime() - b.startDate.toDate().getTime(),
        ),
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
        tenant,
      );
      const logs = fetchedData.map((item: any) => ({
        id: item.id,
        bookingId: item.bookingId,
        netId: item.netId,
        lateCancelDate: item.lateCancelDate,
        noShowDate: item.noShowDate,
        excused: item.excused === true,
      }));
      setPreBanLogs(logs);
    } catch (error) {
      console.error("Error fetching pre-ban logs:", error);
    }
  };

  // Super-admin reload now goes through the unified endpoint.
  const fetchSuperAdminUsers = fetchPermissions;

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
        permissionsLoading,
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
        updateBookingInList,
        setFilters,
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
