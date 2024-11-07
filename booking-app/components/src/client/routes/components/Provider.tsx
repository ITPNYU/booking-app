import { ApproverLevel, TableNames } from "@/components/src/policy";
import React, { createContext, useEffect, useMemo, useState } from "react";
import {
  AdminUser,
  Approver,
  Ban,
  Booking,
  BookingType,
  DepartmentType,
  PaUser,
  PagePermission,
  PolicySettings,
  RoomSetting,
  SafetyTraining,
  Settings,
} from "../../../types";

import { useAuth } from "@/components/src/client/routes/components/AuthProvider";
import { fetchAllFutureBooking } from "@/components/src/server/db";
import { clientFetchAllDataFromCollection } from "@/lib/firebase/firebase";

export interface DatabaseContextType {
  adminUsers: AdminUser[];
  bannedUsers: Ban[];
  bookings: Booking[];
  bookingsLoading: boolean;
  liaisonUsers: Approver[];
  departmentNames: DepartmentType[];
  pagePermission: PagePermission;
  paUsers: PaUser[];
  policySettings: PolicySettings;
  roomSettings: RoomSetting[];
  safetyTrainedUsers: SafetyTraining[];
  settings: Settings;
  userEmail: string | undefined;
  reloadAdminUsers: () => Promise<void>;
  reloadApproverUsers: () => Promise<void>;
  reloadBannedUsers: () => Promise<void>;
  reloadBookings: () => Promise<void>;
  reloadDepartmentNames: () => Promise<void>;
  reloadPaUsers: () => Promise<void>;
  reloadBookingTypes: () => Promise<void>;
  reloadSafetyTrainedUsers: () => Promise<void>;
  setUserEmail: (x: string) => void;
}

export const DatabaseContext = createContext<DatabaseContextType>({
  adminUsers: [],
  bannedUsers: [],
  bookings: [],
  bookingsLoading: true,
  liaisonUsers: [],
  departmentNames: [],
  pagePermission: PagePermission.BOOKING,
  paUsers: [],
  policySettings: { finalApproverEmail: "" },
  roomSettings: [],
  safetyTrainedUsers: [],
  settings: { bookingTypes: [] },
  userEmail: undefined,
  reloadAdminUsers: async () => {},
  reloadApproverUsers: async () => {},
  reloadBannedUsers: async () => {},
  reloadBookings: async () => {},
  reloadDepartmentNames: async () => {},
  reloadPaUsers: async () => {},
  reloadBookingTypes: async () => {},
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
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [liaisonUsers, setLiaisonUsers] = useState<Approver[]>([]);
  const [departmentNames, setDepartmentName] = useState<DepartmentType[]>([]);
  const [paUsers, setPaUsers] = useState<PaUser[]>([]);
  const [policySettings, setPolicySettings] = useState<PolicySettings>({
    finalApproverEmail: "",
  });
  const [roomSettings, setRoomSettings] = useState<RoomSetting[]>([]);
  const [safetyTrainedUsers, setSafetyTrainedUsers] = useState<
    SafetyTraining[]
  >([]);
  const [settings, setSettings] = useState<Settings>({ bookingTypes: [] });
  const [userEmail, setUserEmail] = useState<string | undefined>();
  const { user } = useAuth();

  // page permission updates with respect to user email, admin list, PA list
  const pagePermission = useMemo<PagePermission>(() => {
    if (!userEmail) return PagePermission.BOOKING;
    if (adminUsers.map((admin) => admin.email).includes(userEmail))
      return PagePermission.ADMIN;
    console.log("liaisonUsers", liaisonUsers);
    console.log("userEmail", userEmail);
    console.log(
      "liaisonUsers.map((liaison) => liaison.email).includes(userEmail)",
      liaisonUsers.map((liaison) => liaison.email).includes(userEmail)
    );
    if (liaisonUsers.map((liaison) => liaison.email).includes(userEmail)) {
      return PagePermission.LIAISON;
    } else if (paUsers.map((pa) => pa.email).includes(userEmail))
      return PagePermission.PA;
    else return PagePermission.BOOKING;
  }, [userEmail, adminUsers, paUsers, liaisonUsers]);
  console.log("pagePermission", pagePermission);

  useEffect(() => {
    if (!bookingsLoading) {
      fetchSafetyTrainedUsers();
      fetchBannedUsers();
      fetchApproverUsers();
      fetchDepartmentNames();
      fetchSettings();
    } else {
      fetchBookings();
    }
  }, [bookingsLoading, user]);

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
        const finalApprover = all.filter(
          (x) => x.level === ApproverLevel.FINAL
        )[0];
        setLiaisonUsers(liaisons);
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
  };

  return (
    <DatabaseContext.Provider
      value={{
        adminUsers,
        bannedUsers,
        bookings,
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
        reloadApproverUsers: fetchApproverUsers,
        reloadBannedUsers: fetchBannedUsers,
        reloadBookings: fetchBookings,
        reloadDepartmentNames: fetchDepartmentNames,
        reloadPaUsers: fetchPaUsers,
        reloadBookingTypes: fetchBookingTypes,
        reloadSafetyTrainedUsers: fetchSafetyTrainedUsers,
        setUserEmail,
      }}
    >
      {children}
    </DatabaseContext.Provider>
  );
};
