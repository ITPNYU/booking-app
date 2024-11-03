import {
  MEDIA_COMMONS_EMAIL,
  MEDIA_COMMONS_OPERATION_EMAIL,
  FIRESTORE_COLLECTION_SUFFIX as MEDIA_COMMONS_SUFFIX,
  TableNamesMediaCommonsOnly,
} from "./policyMediaCommons";
import {
  FIRESTORE_COLLECTION_SUFFIX as STAGING_SUFFIX,
  TableNamesStagingOnly,
} from "./policyStaging";

import { BookingStatusLabel } from "./types";
import { clientGetFinalApproverEmailFromDatabase } from "@/lib/firebase/firebase";

export enum TableNamesRaw {
  ADMINS = "usersAdmin",
  APPROVERS = "usersApprovers",
  BANNED = "usersBanned",
  BOOKING = "bookings",
  COUNTERS = "counters",
  RESOURCES = "resources",
  SAFETY_TRAINING = "usersWhitelist",
  SETTINGS = "settings",
}

export type TableNames =
  | `${TableNamesRaw}_${string}`
  | TableNamesMediaCommonsOnly
  | TableNamesStagingOnly;

export function getTableName(
  table: TableNamesRaw,
  tenant: Tenants
): TableNames {
  switch (tenant) {
    case Tenants.STAGING:
      return (table + STAGING_SUFFIX) as TableNames;
    default:
      return (table + MEDIA_COMMONS_SUFFIX) as TableNames;
  }
}

export enum Tenants {
  MEDIA_COMMONS = "Media Commons",
  STAGING = "Staging Space",
}

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
    : MEDIA_COMMONS_EMAIL;
