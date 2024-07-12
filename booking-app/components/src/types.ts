import { Timestamp } from "@firebase/firestore";

export type AdminUser = {
  email: string;
  createdAt: string;
};

export type Ban = {
  email: string;
  bannedAt: string;
};

export type Booking = Inputs & {
  id?: string;
  calendarEventId: string;
  email: string;
  startDate: string;
  endDate: string;
  roomId: string;
};

export type BookingFormDetails = Booking & {
  approvalUrl: string;
  bookingToolUrl: string;
  rejectUrl: string;
  headerMessage?: string;
};

export type BookingStatus = {
  calendarEventId: string;
  email: string;
  requestedAt: string;
  firstApprovedAt: string;
  secondApprovedAt: string;
  rejectedAt: string;
  canceledAt: string;
  checkedInAt: string;
  noShowedAt: string;
};

export enum BookingStatusLabel {
  APPROVED = "APPROVED",
  CANCELED = "CANCELED",
  CHECKED_IN = "CHECKED-IN",
  NO_SHOW = "NO-SHOW",
  PRE_APPROVED = "PRE-APPROVED",
  REJECTED = "REJECTED",
  REQUESTED = "REQUESTED",
  UNKNOWN = "UNKNOWN",
}

export type CalendarEvent = {
  title: string;
  start: string;
  end: string;
};

export enum Department {
  ALT = "ALT",
  GAMES = "Game Center",
  IDM = "IDM",
  ITP = "ITP / IMA / Low Res",
  MARL = "MARL",
  MUSIC_TECH = "Music Tech",
  RECORDED_MUSIC = "Recorded Music",
}

export type DevBranch = "development" | "staging" | "production" | "";

export type Inputs = {
  firstName: string;
  lastName: string;
  secondaryName: string;
  nNumber: string;
  netId: string;
  phoneNumber: string;
  department: string;
  role: string;
  sponsorFirstName: string;
  sponsorLastName: string;
  sponsorEmail: string;
  title: string;
  description: string;
  reservationType: string;
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

export type LiaisonType = {
  email: string;
  department: string;
  createdAt: string;
};

export type PaUser = {
  email: string;
  createdAt: Timestamp;
};

export enum PagePermission {
  ADMIN,
  BOOKING,
  PA,
}

export type ReservationType = {
  reservationType: string;
  createdAt: string;
};

export enum Role {
  STUDENT = "Student",
  RESIDENT_FELLOW = "Resident/Fellow",
  FACULTY = "Faculty",
  ADMIN_STAFF = "Admin/Staff",
}

export type RoomSetting = {
  roomId: string;
  name: string;
  capacity: number;
  calendarRef?: any;
};

export type SafetyTraining = {
  email: string;
  completedAt: string;
};

export type Settings = {
  reservationTypes: ReservationType[];
};
