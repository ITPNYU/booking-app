"use client";

import {
  BookingType,
  DepartmentType,
  PaUser,
  PagePermission,
  Settings,
} from "../../types";
import React, { createContext, useContext, useEffect, useState } from "react";

import { TableNamesMediaCommonsOnly } from "../../mediaCommonsPolicy";
import { clientFetchAllDataFromCollection } from "@/lib/firebase/firebase";
import { useAuth } from "./AuthProvider";
import { useSharedDatabase } from "./SharedDatabaseProvider";

type MediaCommonsDatabaseContextType = {
  departmentNames: DepartmentType[];
  paUsers: PaUser[];
  settings: Settings;
  reloadBookingTypes: () => Promise<void>;
  reloadDepartmentNames: () => Promise<void>;
  reloadPaUsers: () => Promise<void>;
};

const MediaCommonsDatabaseContext =
  createContext<MediaCommonsDatabaseContextType>({
    departmentNames: [],
    paUsers: [],
    settings: { bookingTypes: [] },
    reloadBookingTypes: async () => {},
    reloadDepartmentNames: async () => {},
    reloadPaUsers: async () => {},
  });

export const useMediaCommonsDatabase = () =>
  useContext(MediaCommonsDatabaseContext);

export const MediaCommonsDatabaseProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const { adminUsers, approverUsers, bookingsLoading, overridePagePermission } =
    useSharedDatabase();
  const { userEmail } = useAuth();

  const [departmentNames, setDepartmentName] = useState<DepartmentType[]>([]);
  const [paUsers, setPaUsers] = useState<PaUser[]>([]);
  const [settings, setSettings] = useState<Settings>({ bookingTypes: [] });

  useEffect(() => {
    if (!bookingsLoading) {
      fetchDepartmentNames();
      fetchSettings();
    }
  }, [bookingsLoading]);

  useEffect(() => {
    fetchPaUsers();
  }, [userEmail]);

  useEffect(() => {
    if (!userEmail) {
      overridePagePermission(PagePermission.BOOKING);
    } else if (adminUsers.map((admin) => admin.email).includes(userEmail)) {
      overridePagePermission(PagePermission.ADMIN);
    } else if (
      approverUsers.map((liaison) => liaison.email).includes(userEmail)
    ) {
      overridePagePermission(PagePermission.LIAISON);
    } else if (paUsers.map((pa) => pa.email).includes(userEmail)) {
      overridePagePermission(PagePermission.PA);
    } else {
      overridePagePermission(PagePermission.BOOKING);
    }
  }, [overridePagePermission, userEmail, adminUsers, approverUsers, paUsers]);

  const fetchPaUsers = async () => {
    clientFetchAllDataFromCollection(TableNamesMediaCommonsOnly.PAS)
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

  const fetchDepartmentNames = async () => {
    clientFetchAllDataFromCollection(TableNamesMediaCommonsOnly.DEPARTMENTS)
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
    clientFetchAllDataFromCollection(TableNamesMediaCommonsOnly.BOOKING_TYPES)
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

  const fetchSettings = async () => {
    fetchBookingTypes();
  };

  return (
    <MediaCommonsDatabaseContext.Provider
      value={{
        departmentNames,
        paUsers,
        settings,
        reloadBookingTypes: fetchBookingTypes,
        reloadDepartmentNames: fetchDepartmentNames,
        reloadPaUsers: fetchPaUsers,
      }}
    >
      {children}
    </MediaCommonsDatabaseContext.Provider>
  );
};
