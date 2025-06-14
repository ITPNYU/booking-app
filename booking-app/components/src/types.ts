import { Timestamp } from "firebase/firestore";

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
    equipmentCheckedOut: boolean;
  };

// used for Booking table rows that show status
export type BookingRow = Booking & {
  status: BookingStatusLabel;
  id: string;
};

export type BookingFormDetails = Booking & {
  headerMessage?: string;
  id?: string;
};

export type BookingStatus = {
  calendarEventId: string;
  email: string;
  requestedAt: Timestamp;
  firstApprovedAt: Timestamp;
  firstApprovedBy: string;
  finalApprovedAt: Timestamp;
  finalApprovedBy: string;
  declinedAt: Timestamp;
  declinedBy: string;
  declineReason?: string;
  canceledAt: Timestamp;
  canceledBy: string;
  checkedInAt: Timestamp;
  checkedInBy: string;
  checkedOutAt: Timestamp;
  checkedOutBy: string;
  noShowedAt: Timestamp;
  noShowedBy: string;
  walkedInAt: Timestamp;
  origin: "walk-in" | "vip";
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
  MODIFIED = "MODIFIED",
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
  VIP = "/vip",
}

export type Inputs = {
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
  webcheckoutCartNumber?: string;
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

export enum Days {
  Sunday = "Sunday",
  Monday = "Monday",
  Tuesday = "Tuesday",
  Wednesday = "Wednesday",
  Thursday = "Thursday",
  Friday = "Friday",
  Saturday = "Saturday",
}

export type OperationHours = {
  day: Days;
  open: number;
  close: number;
  isClosed: boolean;
  roomId?: number;
};

export type PaUser = {
  email: string;
  createdAt: string;
};

export enum PagePermission {
  BOOKING = 0,
  PA,
  LIAISON,
  EQUIPMENT,
  ADMIN,
}

export enum PageContextLevel {
  USER = 0,
  LIAISON,
  PA,
  EQUIPMENT,
  ADMIN,
}

export type BlackoutPeriod = {
  id?: string;
  name: string;
  startDate: Timestamp;
  endDate: Timestamp;
  isActive: boolean;
  createdAt: Timestamp;
  updatedAt?: Timestamp;
};

export type PolicySettings = {
  finalApproverEmail: string;
};

export enum Role {
  STUDENT = "Student",
  RESIDENT_FELLOW = "Resident/Fellow",
  FACULTY = "Faculty",
  ADMIN_STAFF = "Admin/Staff",
  CHAIR_PROGRAM_DIRECTOR = "Chair/Program Director",
}

export type RoomSetting = {
  roomId: number;
  name: string;
  capacity: string;
  calendarId: string;
  calendarRef?: any;
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

export type Filters = {
  dateRange: string | Date[];
  sortField: string;
  searchQuery?: string;
};

export interface PreBanLog {
  id: string;
  bookingId: string;
  netId: string;
  lateCancelDate?: Timestamp;
  noShowDate?: Timestamp;
}

export interface BookingLog {
  id: string;
  bookingId: string;
  calendarEventId?: string;
  status: BookingStatusLabel;
  changedBy: string;
  changedAt: any;
  note?: any;
  requestNumber: number;
}
