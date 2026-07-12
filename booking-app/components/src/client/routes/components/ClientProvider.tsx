"use client";

import React, { useMemo } from "react";
import { usePathname } from "next/navigation";
import { DatabaseProvider } from "@/components/src/client/routes/components/Provider";
import { BookingProvider } from "../booking/bookingProvider";

type ClientProviderProps = {
  children: React.ReactNode;
};

// Include originating pages that call loadExistingBookingData before navigating
// to /edit or /modification (my-bookings EDIT, pa MODIFICATION), plus other
// booking-table pages that mount useBookingActions against BookingContext.
const BOOKING_FLOW_SEGMENTS = [
  "book",
  "walk-in",
  "vip",
  "edit",
  "modification",
  "admin",
  "my-bookings",
  "pa",
  "liaison",
  "services",
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
