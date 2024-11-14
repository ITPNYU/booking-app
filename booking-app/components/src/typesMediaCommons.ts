import { BookingFormDetails, BookingRow, BookingStatus, Inputs } from "./types";

import { Timestamp } from "@firebase/firestore";

export enum AttendeeAffiliation {
  NYU = "NYU Members with an active NYU ID",
  NON_NYU = "Non-NYU guests",
  BOTH = "All of the above",
}

export type BookingMediaCommons = InputsMediaCommons &
  BookingStatusMediaCommons & {
    calendarEventId: string;
    email: string;
    startDate: Timestamp;
    endDate: Timestamp;
    roomId: string;
    requestNumber: number;
    equipmentCheckedOut: boolean;
  };

export type BookingFormDetailsMediaCommons = BookingMediaCommons &
  BookingFormDetails;

// used for Booking table rows that show status
export type BookingRowMediaCommons = BookingMediaCommons & BookingRow;

export type BookingStatusMediaCommons = BookingStatus & {
  firstApprovedAt: Timestamp;
  firstApprovedBy: string;
  checkedInAt: Timestamp;
  checkedInBy: string;
  checkedOutAt: Timestamp;
  checkedOutBy: string;
  noShowedAt: Timestamp;
  noShowedBy: string;
  walkedInAt: Timestamp;
};

export type BookingType = {
  bookingType: string;
  createdAt: string;
};

export enum Department {
  ALT = "ALT",
  CDI = "CDI",
  GAMES = "Game Center",
  IDM = "IDM",
  ITP = "ITP / IMA / Low Res",
  MARL = "MARL",
  MPAP = "MPAP",
  MUSIC_TECH = "Music Tech",
  OTHER = "Other",
}

export type DepartmentType = {
  department: string;
  createdAt: string;
  departmentTier: string;
};

export type InputsMediaCommons = Inputs & {
  firstName: string;
  lastName: string;
  secondaryName: string;
  nNumber: string;
  netId: string;
  phoneNumber: string;
  department: string;
  otherDepartment: string;
  role: string;
  sponsorFirstName: string;
  sponsorLastName: string;
  sponsorEmail: string;
  title: string;
  description: string;
  bookingType: string;
  attendeeAffiliation: string;
  roomSetup: string;
  setupDetails: string;
  mediaServices: string;
  mediaServicesDetails: string;
  catering: string;
  hireSecurity: string;
  expectedAttendance: string;
  cateringService: string;
  missingEmail?: string;
  chartFieldForCatering: string;
  chartFieldForSecurity: string;
  chartFieldForRoomSetup: string;
};

export enum MediaServices {
  AUDIO_TECH_103 = "(Garage 103) Request an audio technician",
  AUDIO_TECH_230 = "(Audio Lab 230) Request an audio technician",
  CAMPUS_MEDIA_SERVICES = "(Rooms 202 and 1201) Contact Campus Media to check out equipment or for technical/event support",
  CHECKOUT_EQUIPMENT = "Checkout Equipment",
  LIGHTING_TECH_103 = "(Garage 103) Request a lighting technician",
  LIGHTING_DMX = "(Rooms 220-224) Using DMX lights in ceiling grid",
}

export type PaUser = {
  email: string;
  createdAt: string;
};

export type Settings = {
  bookingTypes: BookingType[];
};
