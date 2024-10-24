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
    equipmentCheckedOut: boolean;
  };

// used for Booking table rows that show status
export type BookingRow = Booking & {
  status: BookingStatusLabel;
};

export type BookingFormDetails = Booking & {
  approvalUrl: string;
  bookingToolUrl: string;
  declinedUrl: string;
  headerMessage?: string;
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
  declineReason: string;
  canceledAt: Timestamp;
  canceledBy: string;
  checkedInAt: Timestamp;
  checkedInBy: string;
  checkedOutAt: Timestamp;
  checkedOutBy: string;
  noShowedAt: Timestamp;
  noShowedBy: string;
  walkedInAt: Timestamp;
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
