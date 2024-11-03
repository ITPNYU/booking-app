"use client";
import React, { createContext, useContext } from "react";

type StagingDatabaseContextType = {};

const StagingDatabaseContext = createContext<StagingDatabaseContextType>({});

export const useStagingDatabase = () => useContext(StagingDatabaseContext);

export const StagingDatabaseProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  return (
    <StagingDatabaseContext.Provider value={{}}>
      {children}
    </StagingDatabaseContext.Provider>
  );
};
