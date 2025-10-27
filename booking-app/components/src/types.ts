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
    equipmentServices: string;
    equipmentServicesDetails: string;
    staffingServices: string;
    staffingServicesDetails: string;
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
  equipmentAt?: Timestamp;
  equipmentBy?: string;
  equipmentApprovedAt?: Timestamp;
  equipmentApprovedBy?: string;
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
  closedAt: Timestamp;
  closedBy: string;
  walkedInAt: Timestamp;
  origin: BookingOrigin;
  xstateData?: any; // XState machine data for tenants using XState
  // Media Commons service approval fields (optional)
  staffServiceApproved?: boolean;
  equipmentServiceApproved?: boolean;
  cateringServiceApproved?: boolean;
  cleaningServiceApproved?: boolean;
  securityServiceApproved?: boolean;
  setupServiceApproved?: boolean;
};

// the order here is the order these are displayed as table filters
export enum BookingStatusLabel {
  APPROVED = "APPROVED",
  CANCELED = "CANCELED",
  CHECKED_IN = "CHECKED-IN",
  CHECKED_OUT = "CHECKED-OUT",
  CLOSED = "CLOSED",
  EQUIPMENT = "EQUIPMENT",
  NO_SHOW = "NO-SHOW",
  PENDING = "PENDING",
  PRE_APPROVED = "PRE-APPROVED",
  DECLINED = "DECLINED",
  MODIFIED = "MODIFIED",
  REQUESTED = "REQUESTED",
  UNKNOWN = "UNKNOWN",
  WALK_IN = "WALK-IN",
}

export type BookingType = {
  id: string;
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
  equipmentServices: string;
  equipmentServicesDetails: string;
  staffingServices: string;
  staffingServicesDetails: string;
  catering: string;
  hireSecurity: string;
  expectedAttendance: string;
  cateringService: string;
  cleaningService: string;
  missingEmail?: string;
  chartFieldForCatering: string;
  chartFieldForCleaning: string;
  chartFieldForSecurity: string;
  chartFieldForRoomSetup: string;
  webcheckoutCartNumber?: string;
  // Individual service fields for pregame parsing
  equipment?: string;
  staffing?: string;
  cleaning?: string;
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

export enum EquipmentServices {
  CHECKOUT_EQUIPMENT = "Checkout Equipment",
}

export enum StaffingServices {
  AUDIO_TECH_103 = "(Garage 103) Request an audio technician",
  AUDIO_TECH_230 = "(Audio Lab 230) Request an audio technician",
  CAMPUS_MEDIA_SERVICES = "(Rooms 202 and 1201) Contact Campus Media for technical/event support",
  LIGHTING_TECH_103 = "(Garage 103) Request a lighting technician",
  LIGHTING_DMX = "(Rooms 220-224) Using DMX lights in ceiling grid",
}

export enum CateringServices {
  OUTSIDE_CATERING = "Outside Catering",
  NYU_PLATED = "NYU Plated",
}

export enum CleaningServices {
  CBS_CLEANING = "CBS Cleaning Services",
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
  BOOKING = "BOOKING",
  PA = "PA",
  LIAISON = "LIAISON",
  SERVICES = "SERVICES",
  ADMIN = "ADMIN",
  SUPER_ADMIN = "SUPER_ADMIN",
}

export enum PageContextLevel {
  USER = 0,
  PA,
  LIAISON,
  SERVICES,
  ADMIN,
}

export type BlackoutPeriod = {
  id?: string;
  name: string;
  startDate: Timestamp;
  endDate: Timestamp;
  startTime?: string; // Time in HH:mm format (e.g., "09:00")
  endTime?: string; // Time in HH:mm format (e.g., "17:00")
  isActive: boolean;
  createdAt: Timestamp;
  updatedAt?: Timestamp;
  roomIds?: number[]; // Optional array of room IDs - if empty/undefined, applies to all rooms
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
  // New schema fields for compatibility
  needsSafetyTraining?: boolean;
  shouldAutoApprove?: boolean;
  isWalkIn?: boolean;
  isWalkInCanBookTwo?: boolean;
  isEquipment?: boolean;
  services?: string[];
  staffingServices?: string[]; // Specific staffing service options for this room
  staffingSections?: { name: string; indexes: number[] }[];
  maxHour?: {
    student: number;
    faculty: number;
    admin: number;
    studentWalkIn: number;
    facultyWalkIn: number;
    adminWalkIn: number;
  };
  minHour?: {
    student: number;
    faculty: number;
    admin: number;
    studentWalkIn: number;
    facultyWalkIn: number;
    adminWalkIn: number;
  };
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

export enum BookingOrigin {
  USER = "user",
  ADMIN = "admin",
  WALK_IN = "walk-in",
  VIP = "vip",
  SYSTEM = "system",
  PREGAME = "pre-game",
}

export const formatOrigin = (
  origin: BookingOrigin | string | undefined
): string => {
  if (!origin) return "User";
  switch (origin) {
    case BookingOrigin.USER:
      return "User";
    case BookingOrigin.ADMIN:
      return "Admin";
    case BookingOrigin.WALK_IN:
      return "Walk-In";
    case BookingOrigin.VIP:
      return "VIP";
    case BookingOrigin.SYSTEM:
      return "System";
    case BookingOrigin.PREGAME:
      return "Pregame";
    default:
      // fallback: capitalize first letter
      return origin.charAt(0).toUpperCase() + origin.slice(1);
  }
};
