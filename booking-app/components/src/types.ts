// import { BookingMediaCommons } from "./typesMediaCommons";

import { Timestamp } from "@firebase/firestore";

export type AdminUser = {
  email: string;
  createdAt: string;
};

export type Approver = {
  email: string;
  department: string;
  createdAt: string;
  level: number;
};

export enum AttendeeAffiliation {
  NYU = "NYU Members with an active NYU ID",
  NON_NYU = "Non-NYU guests",
  BOTH = "All of the above",
}

export type Ban = {
  email: string;
  bannedAt: string;
};

export type Booking = Inputs &
  BookingStatus & {
    calendarEventId: string;
    email: string;
    startDate: Timestamp;
    endDate: Timestamp;
    roomId: string;
    requestNumber: number;
  };

export type BookingStatus = {
  calendarEventId: string;
  email: string;
  requestedAt: Timestamp;
  canceledAt: Timestamp;
  canceledBy: string;
  declinedAt: Timestamp;
  declinedBy: string;
  declineReason: string;
  finalApprovedAt: Timestamp;
  finalApprovedBy: string;
};

export type BookingFormDetails = {
  headerMessage?: string;
  bookingToolUrl?: string;
};

export type BookingRow = Booking & {
  status: BookingStatusLabel;
};

// the order here is the order these are displayed as table filters
export enum BookingStatusLabel {
  APPROVED = "APPROVED",
  CANCELED = "CANCELED",
  CHECKED_IN = "CHECKED-IN",
  CHECKED_OUT = "CHECKED-OUT",
  NO_SHOW = "NO-SHOW",
  PENDING = "PENDING",
  DECLINED = "DECLINED",
  REQUESTED = "REQUESTED",
  UNKNOWN = "UNKNOWN",
  WALK_IN = "WALK-IN",
}

export type BookingType = {
  bookingType: string;
  createdAt: string;
};

export type CalendarEvent = {
  title: string;
  start: string;
  end: string;
  id: string;
  resourceId: string;
  display?: string;
  overlap?: boolean;
  url?: string;
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
export type DevBranch = "development" | "staging" | "production" | "";

export enum ApproverType {
  LIAISON = "liaison",
  FINAL_APPROVER = "admin",
}

// what context are we entering the form in?
export enum FormContextLevel {
  EDIT = "/edit",
  FULL_FORM = "/book",
  MODIFICATION = "/modification",
  WALK_IN = "/walk-in",
}

export type Inputs = {
  firstName: string;
  lastName: string;
  netId: string;
  role: string;
  title: string;
  description: string;
};

export type DepartmentType = {
  department: string;
  createdAt: string;
  departmentTier: string;
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

export enum PagePermission {
  BOOKING = 0,
  PA,
  LIAISON,
  ADMIN,
}

export enum PageContextLevel {
  USER = 0,
  LIAISON,
  PA,
  ADMIN,
}

export type PolicySettings = {
  finalApproverEmail: string;
};

export enum Role {
  STUDENT = "Student",
  RESIDENT_FELLOW = "Resident/Fellow",
  FACULTY = "Faculty",
  ADMIN_STAFF = "Admin/Staff",
}

export type Resource = {
  roomId: number;
  name: string;
  capacity?: string;
  calendarId: string;
};

export type SafetyTraining = {
  id: string;
  email: string;
  completedAt: string;
};

export type Settings = {
  bookingTypes: BookingType[];
};

export type SubmitStatus = "none" | "submitting" | "success" | "error";

export interface NYUAuthTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}

export interface TokenResponse {
  scope: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
  id_token: string;
  access_token: string;
}

export interface NYUTokenCache {
  access_token: string;
  expires_at: number;
  token_type: string;
  lastUpdated: number;
  refresh_token?: string;
}

export interface AuthResult {
  isAuthenticated: boolean;
  token: string;
  expiresAt: string;
  error?: string;
}

export interface UserApiData {
  school_abbr?: string;
  school_name?: string;
  reporting_dept_code?: string;
  reporting_dept_name?: string;
  dept_code?: string;
  affiliation?: string;
  preferred_last_name?: string;
  affiliation_sub_type?: string;
  university_id?: string;
  netid_reachable?: string | null;
  netid?: string;
  primary_affiliation?: string;
  dept_name?: string;
  preferred_first_name?: string;
}
