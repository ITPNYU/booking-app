import { defaultSafetyTrainingInfoUrl } from "@/components/src/constants/safetyTraining";
import { createContext, useContext } from "react";

export { defaultSafetyTrainingInfoUrl };

export type Agreement = {
  id: string;
  html: string;
};

export type StaffingSection = {
  name: string;
  indexes: number[];
};

export type ResourceService = {
  type: string; // e.g. "equipment", "staffing", "setup", "security", "cleaning", "catering", "campus-media"
  approvers: string[]; // NetID email addresses
};

export type Resource = {
  capacity: number;
  name: string;
  roomId: number;
  isEquipment: boolean; // renamed from checkable
  calendarId: string;
  needsSafetyTraining?: boolean; // Whether training is required for this resource
  trainingFormUrl?: string; // URL of the Google Form that tracks trained users
  trainingInfoUrl?: string; // URL to share with users when training is required
  isWalkIn: boolean;
  isWalkInCanBookTwo: boolean;
  services: ResourceService[];
  autoApproval?: {
    minHour?: {
      admin: number;
      faculty: number;
      student: number;
    };
    maxHour?: {
      admin: number;
      faculty: number;
      student: number;
    };
    conditions?: {
      setup: boolean;
      equipment: boolean;
      staffing: boolean;
      catering: boolean;
      cleaning: boolean;
      security: boolean;
    };
  };
  maxHour?: {
    student: number;
    faculty: number;
    admin: number;
    studentWalkIn: number;
    facultyWalkIn: number;
    adminWalkIn: number;
    studentVIP: number;
    facultyVIP: number;
    adminVIP: number;
  };
  minHour?: {
    student: number;
    faculty: number;
    admin: number;
    studentWalkIn: number;
    facultyWalkIn: number;
    adminWalkIn: number;
    studentVIP: number;
    facultyVIP: number;
    adminVIP: number;
  };
  staffingServices?: string[]; // Specific staffing service options for this room
  staffingSections?: StaffingSection[];
  /** Production calendar ID for this resource (stored in DB) */
  calendarIdProd?: string;
  /** Resource-level approvers — used when no per-service approvers are configured */
  approvers?: string[];
};

/** Time-sensitive request warning config (may live at top level in DB or under calendarConfig) */
export type TimeSensitiveRequestWarning = {
  hours?: number;
  isActive?: boolean;
  message?: string;
  policyLink?: string;
};

export type PermissionLabels = {
  user: string;
  worker: string;
  reviewer: string;
  services: string;
  admin: string;
};

export type SchemaContextType = {
  tenant: string; // No default - must be provided
  name: string;
  safetyTrainingGoogleFormId?: string; // Lower priority: used as fallback when resource-level trainingFormUrl is not available
  logo: string;
  nameForPolicy: string;
  policy: string; // innerHTML
  programMapping: Record<string, string[]>;
  roles: string[];
  roleMapping: Record<string, string[]>;
  permissionLabels: PermissionLabels;
  schoolMapping: Record<string, string[]>;
  showNNumber: boolean;
  showSponsor: boolean;
  showSetup: boolean;
  showEquipment: boolean;
  showStaffing: boolean;
  showCatering: boolean;
  showHireSecurity: boolean;
  showBookingTypes: boolean;
  agreements: Agreement[]; // innerHTML[]
  resources: Resource[];
  supportVIP: boolean;
  supportWalkIn: boolean;
  supportPA?: boolean;
  supportLiaison?: boolean;
  resourceName: string;
  declinedGracePeriod?: number;
  /** Hours pending approval before a row is highlighted on the admin bookings dashboard (default 18) */
  interimHighlightThresholdHours?: number;
  /** Top-level time-sensitive warning (DB stores here; also supported under calendarConfig) */
  timeSensitiveRequestWarning?: TimeSensitiveRequestWarning;
  calendarConfig?: {
    startHour?: Record<string, string>; // e.g., { studentVIP: "06:00:00", student: "09:00:00", ... }
    slotUnit?: Record<string, number>; // e.g., { student: 15, admin: 15, ... }
    timeSensitiveRequestWarning?: TimeSensitiveRequestWarning;
  };
  // CC email addresses for notifications, per environment
  ccEmails?: {
    approved: { development: string; staging: string; production: string };
    canceled: { development: string; staging: string; production: string };
  };
  // Email messages for all scenarios
  emailMessages: {
    requestConfirmation: string;
    firstApprovalRequest: string;
    secondApprovalRequest: string;
    walkInConfirmation: string;
    vipConfirmation: string;
    checkoutConfirmation: string;
    checkinConfirmation: string;
    declined: string;
    canceled: string;
    lateCancel: string;
    noShow: string;
    closed: string;
    approvalNotice: string;
  };
};

// This is for the sync script to merge defaults into the existing array.
// The script will check for the __defaults__ property and merge the defaults into the existing array.
// If the __defaults__ property is not found, the script will skip the array.

// An array with a __defaults__ property for sync script compatibility
export interface ObjectArrayWithDefaults<T> extends Array<T> {
  __defaults__: T;
}

function defineObjectArrayWithDefaults<T>(
  defaults: T,
): ObjectArrayWithDefaults<T> {
  const value = [] as ObjectArrayWithDefaults<T>;
  value.__defaults__ = defaults;
  return value;
}

export const defaultStaffingSection: StaffingSection = {
  name: "",
  indexes: [],
};

export const defaultAgreement: Agreement = {
  id: "",
  html: "",
};

export const defaultResource: Resource = {
  capacity: 0,
  name: "",
  roomId: 0,
  isEquipment: false,
  calendarId: "",
  needsSafetyTraining: false,
  isWalkIn: false,
  isWalkInCanBookTwo: false,
  services: [],
  autoApproval: {
    minHour: { admin: -1, faculty: -1, student: -1 },
    maxHour: { admin: -1, faculty: -1, student: -1 },
    conditions: {
      setup: false,
      equipment: false,
      staffing: false,
      catering: false,
      cleaning: false,
      security: false,
    },
  },
  maxHour: {
    student: -1,
    faculty: -1,
    admin: -1,
    studentWalkIn: -1,
    facultyWalkIn: -1,
    adminWalkIn: -1,
    studentVIP: -1,
    facultyVIP: -1,
    adminVIP: -1,
  },
  minHour: {
    student: -1,
    faculty: -1,
    admin: -1,
    studentWalkIn: -1,
    facultyWalkIn: -1,
    adminWalkIn: -1,
    studentVIP: -1,
    facultyVIP: -1,
    adminVIP: -1,
  },
  staffingServices: [],
  staffingSections: defineObjectArrayWithDefaults(defaultStaffingSection),
  trainingFormUrl: "",
  trainingInfoUrl: defaultSafetyTrainingInfoUrl,
  calendarIdProd: "",
  approvers: [],
};

const defaultTimeSensitiveRequestWarning: TimeSensitiveRequestWarning = {
  hours: 48,
  isActive: false,
  message: "",
  policyLink: "",
};

const defaultPermissionLabelsByTenant = (tenant?: string): PermissionLabels => {
  const normalized = (tenant || "").toLowerCase();
  if (normalized === "itp") {
    return {
      user: "User",
      worker: "ER",
      reviewer: "1st Approver",
      services: "Services",
      admin: "Admin",
    };
  }
  return {
    user: "User",
    worker: "PA",
    reviewer: "Liaison",
    services: "Services",
    admin: "Admin",
  };
};

export const defaultScheme: Omit<SchemaContextType, "tenant"> = {
  name: "",
  safetyTrainingGoogleFormId: "",
  logo: "",
  nameForPolicy: "",
  policy: "",
  programMapping: {},
  roles: [],
  roleMapping: {},
  permissionLabels: defaultPermissionLabelsByTenant(),
  showNNumber: true,
  showSponsor: true,
  showSetup: true,
  showEquipment: true,
  showStaffing: true,
  showCatering: true,
  showHireSecurity: true,
  showBookingTypes: true,
  agreements: defineObjectArrayWithDefaults(defaultAgreement),
  resources: defineObjectArrayWithDefaults(defaultResource),
  supportVIP: false,
  supportWalkIn: false,
  supportPA: false,
  supportLiaison: false,
  resourceName: "",
  declinedGracePeriod: 24,
  interimHighlightThresholdHours: 18,
  timeSensitiveRequestWarning: defaultTimeSensitiveRequestWarning,
  calendarConfig: {
    startHour: {
      student: "09:00:00",
      studentVIP: "06:00:00",
      studentWalkIn: "09:00:00",
      faculty: "09:00:00",
      facultyVIP: "06:00:00",
      facultyWalkIn: "09:00:00",
      admin: "09:00:00",
      adminVIP: "06:00:00",
      adminWalkIn: "09:00:00",
    },
    slotUnit: {
      student: 15,
      studentVIP: 15,
      studentWalkIn: 15,
      faculty: 15,
      facultyVIP: 15,
      facultyWalkIn: 15,
      admin: 15,
      adminVIP: 15,
      adminWalkIn: 15,
    },
    timeSensitiveRequestWarning: defaultTimeSensitiveRequestWarning,
  },
  schoolMapping: {},
  ccEmails: {
    approved: { development: "", staging: "", production: "" },
    canceled: { development: "", staging: "", production: "" },
  },
  emailMessages: {
    requestConfirmation: "",
    firstApprovalRequest: "",
    secondApprovalRequest: "",
    walkInConfirmation: "",
    vipConfirmation: "",
    checkoutConfirmation: "",
    checkinConfirmation: "",
    declined: "",
    canceled: "",
    lateCancel: "",
    noShow: "",
    closed: "",
    approvalNotice: "",
  },
};

/**
 * Generate a complete default schema with tenant
 */
export function generateDefaultSchema(tenant: string): SchemaContextType {
  return {
    tenant,
    ...defaultScheme,
    permissionLabels: defaultPermissionLabelsByTenant(tenant),
  };
}

export const SchemaContext = createContext<SchemaContextType>(
  generateDefaultSchema(""),
);

export const useTenantSchema = () => useContext(SchemaContext);

export const SchemaProvider: React.FC<{
  value: SchemaContextType;
  children: React.ReactNode;
}> = ({ value, children }) => {
  return (
    <SchemaContext.Provider value={value}>{children}</SchemaContext.Provider>
  );
};
