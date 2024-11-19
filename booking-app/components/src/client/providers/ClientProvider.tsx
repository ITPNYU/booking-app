// components/ClientProvider.tsx
"use client";

import { BookingFormProvider } from "./BookingFormProvider";
import React from "react";
import { SharedDatabaseProvider } from "./SharedDatabaseProvider";

type ClientProviderProps = {
  children: React.ReactNode;
};

const ClientProvider: React.FC<ClientProviderProps> = ({ children }) => {
  return (
    <SharedDatabaseProvider>
      <BookingFormProvider>{children}</BookingFormProvider>
    </SharedDatabaseProvider>
  );
};

export default ClientProvider;
