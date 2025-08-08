import { MEDIA_COMMONS_OPERATION_EMAIL } from "./mediaCommonsPolicy";

import { clientGetFinalApproverEmailFromDatabase } from "@/lib/firebase/firebase";
import { BookingStatusLabel } from "./types";

export enum TableNames {
  ADMINS = "usersAdmin",
  APPROVERS = "usersApprovers",
  BANNED = "usersBanned",
  BOOKING = "bookings",
  BOOKING_TYPES = "bookingTypes",
  DEPARTMENTS = "departments",
  OPERATION_HOURS = "operationHours",
  PAS = "usersPa",
  RESOURCES = "resources",
  SAFETY_TRAINING = "usersWhitelist",
  SETTINGS = "settings",
  PRE_BAN_LOGS = "preBanLogs",
  BOOKING_LOGS = "bookingLogs",
  SUPER_ADMINS = "usersSuperAdmin",
  POLICY_SETTINGS = "policySettings",
  BLACKOUT_PERIODS = "blackoutPeriods",
  TENANT_SCHEMA = "tenantSchema",
}

// Utility function to get tenant-specific collection names
export const getTenantCollectionName = (baseCollection: string, tenant?: string): string => {
  if (!tenant) {
    return baseCollection;
  }
  
  // Collections that should be tenant-specific
  const tenantSpecificCollections = [
    "bookings",
    "bookingLogs", 
    "bookingTypes",
    "blackoutPeriods",
    "counters",
    "operationHours",
    "preBanLogs",
    "usersWhitelist"
  ];
  
  if (tenantSpecificCollections.includes(baseCollection)) {
    return `${tenant}-${baseCollection}`;
  }
  
  return baseCollection;
};

// Helper function to get tenant-specific TableNames
export const getTenantTableName = (tableName: TableNames, tenant?: string): string => {
  const baseCollection = tableName;
  return getTenantCollectionName(baseCollection, tenant);
};

export const CALENDAR_HIDE_STATUS = [
  BookingStatusLabel.NO_SHOW,
  BookingStatusLabel.CANCELED,
  BookingStatusLabel.DECLINED,
  BookingStatusLabel.CHECKED_OUT,
];

export const BOOKING_TABLE_HIDE_STATUS_TIME_ELAPSED = [
  BookingStatusLabel.NO_SHOW,
  BookingStatusLabel.CHECKED_OUT,
  BookingStatusLabel.CANCELED,
];
export enum ApproverLevel {
  FIRST = 1,
  FINAL = 2,
  EQUIPMENT = 3,
}

/********** CONTACTS ************/

export const clientGetFinalApproverEmail = async (): Promise<string> => {
  const finalApproverEmail = await clientGetFinalApproverEmailFromDatabase();
  return (
    finalApproverEmail || "booking-app-devs+notFoundFinalApprover@itp.nyu.edu"
  );
};

export const getApprovalCcEmail = (branchName: string) =>
  branchName === "development"
    ? "booking-app-devs+operation@itp.nyu.edu"
    : MEDIA_COMMONS_OPERATION_EMAIL;

export const getCancelCcEmail = () =>
  process.env.NEXT_PUBLIC_BRANCH_NAME === "development"
    ? "booking-app-devs+cancelcc@itp.nyu.edu"
    : MEDIA_COMMONS_OPERATION_EMAIL;
