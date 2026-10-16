"use client";

import {
  BOOKING_FLOW_SEGMENTS,
  isFlowSegment,
} from "@/components/src/constants/flowSegments";
import React, { useMemo } from "react";
import { usePathname } from "next/navigation";
import { DatabaseProvider } from "@/components/src/client/routes/components/Provider";
import { BookingProvider } from "../booking/bookingProvider";

type ClientProviderProps = {
  children: React.ReactNode;
};

const ClientProvider: React.FC<ClientProviderProps> = ({ children }) => {
  const pathname = usePathname();
  const needsBookingProvider = useMemo(() => {
    if (!pathname) return false;
    const segments = pathname.split("/").filter(Boolean);
    // Tenant root `/[tenant]` renders MyBookingsPage for BOOKING users
    // (PERMISSION_PATH omits BOOKING), so Edit preload needs BookingProvider.
    if (segments.length === 1) return true;
    return segments.some((segment) =>
      isFlowSegment(BOOKING_FLOW_SEGMENTS, segment),
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
