"use client";

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
} from "../../types";
import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { TableNamesMediaCommonsOnly } from "../../mediaCommonsPolicy";
import { clientFetchAllDataFromCollection } from "@/lib/firebase/firebase";
import { useAuth } from "./AuthProvider";
import { useSharedDatabase } from "./SharedDatabaseProvider";

type StagingDatabaseContextType = {
  pagePermission: PagePermission;
};

const StagingDatabaseContext = createContext<StagingDatabaseContextType>({
  pagePermission: PagePermission.BOOKING,
});

export const useStagingDatabase = () => useContext(StagingDatabaseContext);

export const StagingDatabaseProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const { adminUsers, liaisonUsers } = useSharedDatabase();
  const { userEmail } = useAuth();

  // page permission updates with respect to user email, admin list, PA list
  const pagePermission = useMemo<PagePermission>(() => {
    if (!userEmail) return PagePermission.BOOKING;
    if (adminUsers.map((admin) => admin.email).includes(userEmail))
      return PagePermission.ADMIN;
    if (liaisonUsers.map((liaison) => liaison.email).includes(userEmail)) {
      return PagePermission.LIAISON;
    } else return PagePermission.BOOKING;
  }, [userEmail, adminUsers]);

  return (
    <StagingDatabaseContext.Provider value={{ pagePermission }}>
      {children}
    </StagingDatabaseContext.Provider>
  );
};
