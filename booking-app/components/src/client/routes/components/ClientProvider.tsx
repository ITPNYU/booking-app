"use client";

import React, { useMemo } from "react";
import { usePathname } from "next/navigation";
import { DatabaseProvider } from "@/components/src/client/routes/components/Provider";
import { BookingProvider } from "../booking/bookingProvider";

type ClientProviderProps = {
  children: React.ReactNode;
};

const BOOKING_FLOW_SEGMENTS = [
  "book",
  "walk-in",
  "vip",
  "edit",
  "modification",
  "admin",
];

const ClientProvider: React.FC<ClientProviderProps> = ({ children }) => {
  const pathname = usePathname();
  const needsBookingProvider = useMemo(() => {
    if (!pathname) return false;
    const segments = pathname.split("/").filter(Boolean);
    return segments.some((segment) =>
      BOOKING_FLOW_SEGMENTS.includes(segment),
    );
  }, [pathname]);

  return (
    <DatabaseProvider>
      {needsBookingProvider ? (
        <BookingProvider>{children}</BookingProvider>
      ) : (
        children
      )}
    </DatabaseProvider>
  );
};

export default ClientProvider;
