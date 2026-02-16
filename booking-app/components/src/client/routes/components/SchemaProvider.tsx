import { createContext, useContext, useEffect } from "react";

export type Agreement = {
  id: string;
  html: string;
};

export type StaffingSection = {
  name: string;
  indexes: number[];
};

export type Resource = {
  capacity: number;
  name: string;
  roomId: number;
  isEquipment: boolean; // renamed from checkable
  calendarId: string;
  needsSafetyTraining: boolean;
  isWalkIn: boolean;
  isWalkInCanBookTwo: boolean;
  services: string[]; // ["equipment", "staffing", "setup", "security", "cleaning", "catering", "campus-media"]
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
  /** Optional URL for room-specific safety training form (stored in DB) */
  trainingFormUrl?: string;
  /** Production calendar ID for this resource (stored in DB) */
  calendarIdProd?: string;
};

/** Time-sensitive request warning config (may live at top level in DB or under calendarConfig) */
export type TimeSensitiveRequestWarning = {
  hours?: number;
  isActive?: boolean;
  message?: string;
  policyLink?: string;
};

export type SchemaContextType = {
  tenant: string; // No default - must be provided
  name: string;
  safetyTrainingGoogleFormId?: string;
  logo: string;
  nameForPolicy: string;
  policy: string; // innerHTML
  programMapping: Record<string, string[]>;
  roles: string[];
  roleMapping: Record<string, string[]>;
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
  resourceName: string;
  /** Top-level time-sensitive warning (DB stores here; also supported under calendarConfig) */
  timeSensitiveRequestWarning?: TimeSensitiveRequestWarning;
  calendarConfig?: {
    startHour?: Record<string, string>; // e.g., { studentVIP: "06:00:00", student: "09:00:00", ... }
    slotUnit?: Record<string, number>; // e.g., { student: 15, admin: 15, ... }
    timeSensitiveRequestWarning?: TimeSensitiveRequestWarning;
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

function defineObjectArrayWithDefaults<T>(defaults: T): ObjectArrayWithDefaults<T> {
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
  calendarIdProd: "",
};

const defaultTimeSensitiveRequestWarning: TimeSensitiveRequestWarning = {
  hours: 48,
  isActive: false,
  message: "",
  policyLink: "",
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
  resourceName: "",
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
  };
}

export const SchemaContext = createContext<SchemaContextType>(
  generateDefaultSchema("")
);

export const useTenantSchema = () => useContext(SchemaContext);

export const SchemaProvider: React.FC<{
  value: SchemaContextType;
  children: React.ReactNode;
}> = ({ value, children }) => {
  console.log("SchemaProvider: Setting context value (render):", {
    tenant: value?.tenant,
    name: value?.name,
    resourcesCount: value?.resources?.length || 0,
  });

  useEffect(() => {
    console.log("SchemaProvider: Context value after hydration:", {
      tenant: value?.tenant,
      name: value?.name,
      resourcesCount: value?.resources?.length || 0,
    });
  }, [value]);

  return (
    <SchemaContext.Provider value={value}>{children}</SchemaContext.Provider>
  );
};
