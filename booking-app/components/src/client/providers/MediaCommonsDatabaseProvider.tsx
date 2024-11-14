"use client";

import {
  BookingType,
  DepartmentType,
  PaUser,
  PagePermission,
  Settings,
} from "../../types";
import React, { createContext, useContext, useEffect, useState } from "react";

import { BookingMediaCommons } from "../../typesMediaCommons";
import { TableNamesMediaCommonsOnly } from "../../policyMediaCommons";
import { TableNamesRaw } from "../../policy";
import { clientFetchAllDataFromCollection } from "@/lib/firebase/firebase";
import { fetchAllFutureBooking } from "@/components/src/server/db";
import { useAuth } from "./AuthProvider";
import { useSharedDatabase } from "./SharedDatabaseProvider";
import useTableName from "../utils/useTableName";

type MediaCommonsDatabaseContextType = {
  bookings: BookingMediaCommons[];
  departmentNames: DepartmentType[];
  paUsers: PaUser[];
  settings: Settings;
  reloadBookingTypes: () => Promise<void>;
  reloadDepartmentNames: () => Promise<void>;
  reloadPaUsers: () => Promise<void>;
};

const MediaCommonsDatabaseContext =
  createContext<MediaCommonsDatabaseContextType>({
    bookings: [],
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
  const {
    adminUsers,
    approverUsers,
    bookingsLoading,
    setBookingsLoading,
    setFetchBookings,
    overridePagePermission,
  } = useSharedDatabase();
  const { userEmail } = useAuth();
  const tableName = useTableName();

  const [bookings, setBookings] = useState<BookingMediaCommons[]>([]);
  const [departmentNames, setDepartmentName] = useState<DepartmentType[]>([]);
  const [paUsers, setPaUsers] = useState<PaUser[]>([]);
  const [settings, setSettings] = useState<Settings>({ bookingTypes: [] });

  useEffect(() => {
    if (!bookingsLoading) {
      fetchDepartmentNames();
      fetchSettings();
    } else {
      fetchBookings();
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

  const fetchBookings = async () => {
    fetchAllFutureBooking(tableName(TableNamesRaw.BOOKING))
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

  // give callback to parent provider
  useEffect(() => {
    if (fetchBookings) setFetchBookings(() => fetchBookings);
  }, []);

  return (
    <MediaCommonsDatabaseContext.Provider
      value={{
        bookings,
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
