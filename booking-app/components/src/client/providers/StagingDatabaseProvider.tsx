"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

import { BookingStaging } from "../../typesStaging";
import { TableNamesRaw } from "../../policy";
import { fetchAllFutureBooking } from "@/components/src/server/db";
import { useSharedDatabase } from "./SharedDatabaseProvider";
import useTableName from "../utils/useTableName";

type StagingDatabaseContextType = {
  bookings: BookingStaging[];
};

const StagingDatabaseContext = createContext<StagingDatabaseContextType>({
  bookings: [],
});

export const useStagingDatabase = () => useContext(StagingDatabaseContext);

export const StagingDatabaseProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const { bookingsLoading, setBookingsLoading, setFetchBookings } =
    useSharedDatabase();
  const tableName = useTableName();

  const [bookings, setBookings] = useState<BookingStaging[]>([]);

  useEffect(() => {
    if (bookingsLoading) {
      fetchBookings();
    }
  }, [bookingsLoading]);

  const fetchBookings = async () => {
    fetchAllFutureBooking(tableName(TableNamesRaw.BOOKING))
      .then((fetchedData) => {
        const bookings = fetchedData.map((item: any) => ({
          id: item.id,
          calendarEventId: item.calendarEventId,
          email: item.email,
          startDate: item.startDate,
          endDate: item.endDate,
          roomId: String(item.roomId),
          requestNumber: item.requestNumber,
          firstName: item.firstName,
          lastName: item.lastName,
          netId: item.netId,
          role: item.role,
          title: item.title,
          description: item.description,
          projectDatabaseUrl: item.projectDatabaseUrl,
          requestedAt: item.requestedAt,
          finalApprovedAt: item.finalApprovedAt,
          finalApprovedBy: item.finalApprovedBy,
          declinedAt: item.declinedAt,
          declinedBy: item.declinedBy,
          declineReason: item.declineReason,
          canceledAt: item.canceledAt,
          canceledBy: item.canceledBy,
        }));
        setBookings(bookings);
        setBookingsLoading(false);
      })
      .catch((error) => console.error("Error fetching data:", error));
  };

  // give callback to parent provider
  useEffect(() => {
    setFetchBookings(() => fetchBookings);
  }, []);

  return (
    <StagingDatabaseContext.Provider value={{ bookings }}>
      {children}
    </StagingDatabaseContext.Provider>
  );
};
