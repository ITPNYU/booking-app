"use client";

import { PaUser, PagePermission } from "../../types";
import React, { createContext, useContext, useEffect, useState } from "react";

import { TableNamesMediaCommonsOnly } from "../../mediaCommonsPolicy";
import { clientFetchAllDataFromCollection } from "@/lib/firebase/firebase";
import { useAuth } from "./AuthProvider";
import { useSharedDatabase } from "./SharedDatabaseProvider";

type MediaCommonsDatabaseContextType = {
  paUsers: PaUser[];
  reloadPaUsers: () => Promise<void>;
};

const MediaCommonsDatabaseContext =
  createContext<MediaCommonsDatabaseContextType>({
    paUsers: [],
    reloadPaUsers: async () => {},
  });

export const useMediaCommonsDatabase = () =>
  useContext(MediaCommonsDatabaseContext);

export const MediaCommonsDatabaseProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const [paUsers, setPaUsers] = useState<PaUser[]>([]);
  const { adminUsers, liaisonUsers } = useSharedDatabase();
  const { userEmail } = useAuth();

  const { overridePagePermission } = useSharedDatabase();

  useEffect(() => {
    fetchPaUsers();
  }, [userEmail]);

  useEffect(() => {
    if (!userEmail) {
      overridePagePermission(PagePermission.BOOKING);
    } else if (adminUsers.map((admin) => admin.email).includes(userEmail)) {
      overridePagePermission(PagePermission.ADMIN);
    } else if (
      liaisonUsers.map((liaison) => liaison.email).includes(userEmail)
    ) {
      overridePagePermission(PagePermission.LIAISON);
    } else if (paUsers.map((pa) => pa.email).includes(userEmail)) {
      overridePagePermission(PagePermission.PA);
    } else {
      overridePagePermission(PagePermission.BOOKING);
    }
  }, [overridePagePermission, userEmail, adminUsers, liaisonUsers, paUsers]);

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

  return (
    <MediaCommonsDatabaseContext.Provider
      value={{ paUsers, reloadPaUsers: fetchPaUsers }}
    >
      {children}
    </MediaCommonsDatabaseContext.Provider>
  );
};
