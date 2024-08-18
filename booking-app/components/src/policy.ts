/********** GOOGLE SHEETS ************/

import { getFinalApproverEmail } from "@/lib/firebase/firebase";
import { BookingStatusLabel, DevBranch } from "./types";

/** ACTIVE master Google Sheet  */
export const ACTIVE_SHEET_ID = "1MnWbn6bvNyMiawddtYYx0tRW4NMgvugl0I8zBO3sy68";

export function getLiaisonTableName() {
  switch (process.env.BRANCH_NAME as DevBranch) {
    case "development":
      return TableNames.LIAISONS_DEV;
    case "staging":
      return TableNames.LIAISONS_STAGING;
    default:
      return TableNames.LIAISONS_PROD;
  }
}

export enum TableNames {
  ADMINS = "admin_users",
  BANNED = "banned_users",
  BOOKING = "bookings",
  BOOKING_STATUS = "bookingStatus",
  LIAISONS_DEV = "liaisonsDev",
  LIAISONS_PROD = "liaisonsProd",
  LIAISONS_STAGING = "liaisonsStaging",
  DEPARTMENTS = "departments",
  PAS = "pa_users",
  POLICY = "policy",
  RESERVATION_TYPES = "reservationTypes",
  ROOMS = "rooms",
  SAFETY_TRAINING = "safety_training_users",
  SETTINGS = "settings",
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

/********** CONTACTS ************/

export const getSecondApproverEmail = async (): Promise<string> => {
  const finalApproverEmail = await getFinalApproverEmail();
  return (
    finalApproverEmail || "booking-app-devs+notFoundFinalApprover@itp.nyu.edu"
  );
};

export const getApprovalCcEmail = (branchName: string) =>
  branchName === "development"
    ? "booking-app-devs+samantha@itp.nyu.edu"
    : "ss12430@nyu.edu"; // Samantha

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
  BookingStatusLabel.REJECTED,
];

export const STORAGE_KEY_BOOKING = "mediaCommonsDevBooking";
