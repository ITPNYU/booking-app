import {
  MEDIA_COMMONS_EMAIL,
  MEDIA_COMMONS_OPERATION_EMAIL,
} from "./mediaCommonsPolicy";

import { BookingStatusLabel } from "./types";
import { clientGetFinalApproverEmailFromDatabase } from "@/lib/firebase/firebase";

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
