/********** GOOGLE SHEETS ************/

import { BookingStatusLabel } from "./types";
import { clientGetFinalApproverEmailFromDatabase } from "@/lib/firebase/firebase";

/** ACTIVE master Google Sheet  */
export const ACTIVE_SHEET_ID = "1MnWbn6bvNyMiawddtYYx0tRW4NMgvugl0I8zBO3sy68";

export enum TableNames {
  ADMINS = "usersAdmin",
  APPROVERS = "usersApprovers",
  BANNED = "usersBanned",
  BOOKING = "bookings",
  BOOKING_TYPES = "bookingTypes",
  DEPARTMENTS = "departments",
  PAS = "usersPa",
  RESOURCES = "resources",
  SAFETY_TRAINING = "usersWhitelist",
  SETTINGS = "settings",
}

export enum ApproverLevel {
  FIRST = 1,
  FINAL = 2,
}

/** Old safety training Google Sheet */
export const OLD_SAFETY_TRAINING_SHEET_ID =
  "1Debe5qF-2qXJhqP0AMy5etEvwAPd3mNFiTswytsbKxQ";
/** Old safety training sheet within OLD_SAFETY_TRAINING_SHEET_ID */
export const OLD_SAFETY_TRAINING_SHEET_NAME = "Sheet1";
export const SECOND_OLD_SAFETY_TRAINING_SHEET_ID =
  "1TZYBrX5X6TXM07V3OMTOnVWF8qRmWnTzh27zacrQHh0";
export const SECOND_OLD_SAFETY_TRAINING_SHEET_GID = 293202487;
export const MEDIA_COMMON_EMAIL = "mediacommons.reservations@nyu.edu";
export const MEDIA_COMMON_OPERATION_EMAIL = "mediacommons.operations@nyu.edu";

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
    : MEDIA_COMMON_OPERATION_EMAIL;

export const getCancelCcEmail = () =>
  process.env.NEXT_PUBLIC_BRANCH_NAME === "development"
    ? "booking-app-devs+cancelcc@itp.nyu.edu"
    : MEDIA_COMMON_EMAIL;

/********** ROOMS ************/

export const SAFETY_TRAINING_REQUIRED_ROOM = [
  103, 220, 221, 222, 223, 224, 230,
];

export const INSTANT_APPROVAL_ROOMS = [221, 222, 223, 224, 233];

export const CHECKOUT_EQUIPMENT_ROOMS = [
  103, 220, 221, 222, 223, 224, 230, 233, 260,
];

export const CAMPUS_MEDIA_SERVICES_ROOMS = [202, 1201];
export const LIGHTING_DMX_ROOMS = [220, 221, 222, 223, 224];
export const MOCAP_ROOMS = [221, 222];

export const WALK_IN_ROOMS = [220, 221, 222, 223, 224, 230, 233];
export const WALK_IN_CAN_BOOK_TWO = [221, 222, 223, 224];

export const CALENDAR_HIDE_STATUS = [
  BookingStatusLabel.NO_SHOW,
  BookingStatusLabel.CANCELED,
  BookingStatusLabel.DECLINED,
  BookingStatusLabel.CHECKED_OUT,
];

export const STORAGE_KEY_BOOKING = "mediaCommonsDevBooking";
