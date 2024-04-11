/********** GOOGLE SHEETS ************/

import { BookingStatusLabel, DevBranch } from './types';

/** ACTIVE master Google Sheet  */
export const ACTIVE_SHEET_ID = '1MnWbn6bvNyMiawddtYYx0tRW4NMgvugl0I8zBO3sy68';

export function getLiaisonTableName() {
  switch (process.env.BRANCH_NAME as DevBranch) {
    case 'development':
      return TableNames.LIAISONS_DEV;
    case 'staging':
      return TableNames.LIAISONS_STAGING;
    default:
      return TableNames.LIAISONS_PROD;
  }
}

export enum TableNames {
  ADMINS = 'admin_users',
  BANNED = 'banned_users',
  BOOKING = 'bookings',
  BOOKING_STATUS = 'bookingStatus',
  LIAISONS_DEV = 'liaisonsDev',
  LIAISONS_PROD = 'liaisonsProd',
  LIAISONS_STAGING = 'liaisonsStaging',
  PAS = 'pa_users',
  ROOMS = 'rooms',
  SAFETY_TRAINING = 'safety_training_users',
  SETTINGS = 'settings',
}

export enum ActiveSheetBookingStatusColumns {
  CALENDAR_ID = 0,
  EMAIL = 1,
  REQUESTED_DATE = 2,
  FIRST_APPROVED_DATE = 3,
  SECOND_APPROVED_DATE = 4,
  REJECTED_DATE = 5,
  CANCELLED_DATE = 6,
  CHECKED_IN_DATE = 7,
  NO_SHOWED_DATE = 8,
}

export enum ActiveSheetRoomsColumns {
  ROOM_ID = 0,
  NAME = 1,
  CAPACITY = 2,
  CALENDAR_ID = 3,
  CALENDAR_ID_PROD = 4,
}

/** Old safety training Google Sheet */
export const OLD_SAFETY_TRAINING_SHEET_ID =
  '1Debe5qF-2qXJhqP0AMy5etEvwAPd3mNFiTswytsbKxQ';
/** Old safety training sheet within OLD_SAFETY_TRAINING_SHEET_ID */
export const OLD_SAFETY_TRAINING_SHEET_NAME = 'Sheet1';

/********** CONTACTS ************/

// TODO configure this via admin UI
export const getSecondApproverEmail = (branchName: string) =>
  branchName === 'development'
    ? 'media-commons-devs@itp.nyu.edu'
    : 'jg5626@nyu.edu'; // Jhanele

/********** ROOMS ************/

export type Purpose = 'multipleRoom' | 'motionCapture';

export const SAFETY_TRAINING_REQUIRED_ROOM = [
  '103',
  '220',
  '221',
  '222',
  '223',
  '224',
  '230',
];

export const INSTANT_APPROVAL_ROOMS = ['221', '222', '223', '224', '233'];

export const HIDING_STATUS = [
  BookingStatusLabel.NO_SHOW,
  BookingStatusLabel.CANCELED,
  BookingStatusLabel.REJECTED,
];
