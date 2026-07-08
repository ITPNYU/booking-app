// Server-safe tenant-schema types and defaults.
//
// This module deliberately contains NO React (`createContext`) so it can be
// imported from server code (API routes, `lib/tenant/coerceTenantSchema`,
// scripts) without pulling the client-only `SchemaProvider` into the server
// bundle. `SchemaProvider.tsx` re-exports everything here for client consumers.

import { defaultSafetyTrainingInfoUrl } from "@/components/src/constants/safetyTraining";

export { defaultSafetyTrainingInfoUrl };

export type Attestation = {
  id: string;
  html: string;
};

export type StaffingSection = {
  name: string;
  indexes: number[];
};

export type ResourceTraining = {
  required?: boolean;
  formId?: string;
  infoUrl?: string;
};

export type RequestLimitPeriod = "perDay" | "perWeek" | "perMonth" | "perSemester";

/** Keys in `resource.requestLimits` — one bucket per base role (VIP / walk-in share the same cap). */
export type RequestLimitBucketKey = "admin" | "faculty" | "student";

export type RequestLimits = Partial<
  Record<RequestLimitPeriod, Partial<Record<RequestLimitBucketKey, number>>>
>;

export type Resource = {
  capacity: number;
  name: string;
  resourceId: string;
  isEquipment: boolean;
  calendarId: string;
  training?: ResourceTraining;
  isWalkIn: boolean;
  isWalkInCanBookTwo: boolean;
  services: string[];
  /**
   * Limit how many requests a user can make per period for this resource.
   * Convention: `-1` (or missing) means “unlimited”.
   *
   * Shape: each period has only `admin`, `faculty`, `student` — counts include all booking origins.
   */
  requestLimits?: RequestLimits;
  autoApproval?: {
    shouldAutoApprove?: boolean;
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
  staffingServices?: string[];
  staffingSections?: StaffingSection[];
  calendarIdProd?: string;
};

export type TimeSensitiveRequestWarning = {
  hours?: number;
  isActive?: boolean;
  message?: string;
  policyLink?: string;
};

export type TermRange = [number, number]; // [startMonth, endMonth], 1-12 inclusive

export type TermConfig = {
  fallTerm: TermRange; // e.g. [9, 12]
  springTerm: TermRange; // e.g. [1, 5]
  summerTerm: TermRange; // e.g. [6, 8]
};

export type ContextLabels = {
  user: string;
  worker: string;
  reviewer: string;
  services: string;
  admin: string;
};

export type TenantBranding = {
  name: string;
  logo: string;
  nameForPolicy: string;
  contextLabels: ContextLabels;
};

export type FormServicesConfig = {
  showCatering: boolean;
  showEquipment: boolean;
  showSecurity: boolean;
  showSetup: boolean;
  showStaffing: boolean;
};

export type FormConfig = {
  showBookingType: boolean;
  showNNumber: boolean;
  showSponsor: boolean;
  services: FormServicesConfig;
};

export type OriginsConfig = {
  VIP: boolean;
  walkIn: boolean;
};

export type MappingsConfig = {
  program: Record<string, string[]>;
  role: Record<string, string[]>;
  school: Record<string, string[]>;
};

export type TrainingConfig = {
  formId?: string;
};

export type EmailNotifications = {
  requestedUser: string;
  requestedNeedsApproval: string;
  reviewedNeedsApproval: string;
  approvedWalkIn: string;
  approvedVIP: string;
  checkedOut: string;
  checkedIn: string;
  declined: string;
  canceled: string;
  canceledLate: string;
  noShow: string;
  closed: string;
  approvedUser: string;
};

export type SchemaContextType = {
  /** Tenant slug / document id (e.g. mc, itp) */
  tenantId: string;
  tenant: TenantBranding;
  policy: string;
  mappings: MappingsConfig;
  roles: string[];
  form: FormConfig;
  attestations: Attestation[];
  resources: Resource[];
  origins: OriginsConfig;
  training?: TrainingConfig;
  supportPA?: boolean;
  supportLiaison?: boolean;
  resourceName: string;
  declinedGracePeriod?: number;
  /** Hours pending before interim column text is emphasized on the admin bookings dashboard (default 18) */
  interimHighlightThresholdHours?: number;
  /**
   * When enabled, automatically cancel requests within a time window prior to start time
   * if they are still unapproved (Requested / Pre-approved depending on conditions).
   *
   * Stored as `false` by default for backwards compatibility with older schemas.
   */
  autoCancel?:
    | false
    | {
        minutesPriorToStart: number;
        conditions: {
          requested: boolean;
          preApproved: boolean;
        };
      };
  /** Term/semester configuration for "perSemester" request limits */
  termConfig?: TermConfig;
  calendarConfig?: {
    startHour?: Record<string, string>;
    slotUnit?: Record<string, number>;
    multipleResourceSelect?: boolean;
    timeSensitiveRequestWarning?: TimeSensitiveRequestWarning;
  };
  ccEmails?: {
    approved: { development: string; staging: string; production: string };
    canceled: { development: string; staging: string; production: string };
  };
  emailNotifications: EmailNotifications;
};

function defineObjectArrayWithDefaults<T>(defaults: T): ObjectArrayWithDefaults<T> {
  const value = [] as ObjectArrayWithDefaults<T>;
  value.__defaults__ = defaults;
  return value;
}

export interface ObjectArrayWithDefaults<T> extends Array<T> {
  __defaults__: T;
}

export const defaultStaffingSection: StaffingSection = {
  name: "",
  indexes: [],
};

export const defaultAttestation: Attestation = {
  id: "",
  html: "",
};

export const defaultResource: Resource = {
  capacity: 0,
  name: "",
  resourceId: "",
  isEquipment: false,
  calendarId: "",
  training: {
    required: false,
    formId: "",
    infoUrl: defaultSafetyTrainingInfoUrl,
  },
  isWalkIn: false,
  isWalkInCanBookTwo: false,
  services: [],
  requestLimits: {
    perDay: { admin: -1, faculty: -1, student: -1 },
    perWeek: { admin: -1, faculty: -1, student: -1 },
    perMonth: { admin: -1, faculty: -1, student: -1 },
    perSemester: { admin: -1, faculty: -1, student: -1 },
  },
  autoApproval: {
    shouldAutoApprove: false,
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
  calendarIdProd: "",
};

const defaultTimeSensitiveRequestWarning: TimeSensitiveRequestWarning = {
  hours: 48,
  isActive: false,
  message: "",
  policyLink: "",
};

const defaultContextLabelsByTenantId = (tenantId?: string): ContextLabels => {
  const normalized = (tenantId || "").toLowerCase();
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

const defaultTenantBranding = (tenantId?: string): TenantBranding => ({
  name: "",
  logo: "",
  nameForPolicy: "",
  contextLabels: defaultContextLabelsByTenantId(tenantId),
});

export const defaultScheme: Omit<SchemaContextType, "tenantId"> = {
  tenant: defaultTenantBranding(),
  policy: "",
  mappings: {
    program: {},
    role: {},
    school: {},
  },
  roles: [],
  form: {
    showBookingType: true,
    showNNumber: true,
    showSponsor: true,
    services: {
      showCatering: true,
      showEquipment: true,
      showSecurity: true,
      showSetup: true,
      showStaffing: true,
    },
  },
  attestations: defineObjectArrayWithDefaults(defaultAttestation),
  resources: defineObjectArrayWithDefaults(defaultResource),
  origins: {
    VIP: false,
    walkIn: false,
  },
  training: {
    formId: "",
  },
  supportPA: false,
  supportLiaison: false,
  resourceName: "",
  declinedGracePeriod: 24,
  interimHighlightThresholdHours: 18,
  autoCancel: false,
  termConfig: {
    fallTerm: [9, 12],
    springTerm: [1, 5],
    summerTerm: [6, 8],
  },
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
    multipleResourceSelect: false,
    timeSensitiveRequestWarning: defaultTimeSensitiveRequestWarning,
  },
  ccEmails: {
    approved: { development: "", staging: "", production: "" },
    canceled: { development: "", staging: "", production: "" },
  },
  emailNotifications: {
    requestedUser: "",
    requestedNeedsApproval: "",
    reviewedNeedsApproval: "",
    approvedWalkIn: "",
    approvedVIP: "",
    checkedOut: "",
    checkedIn: "",
    declined: "",
    canceled: "",
    canceledLate: "",
    noShow: "",
    closed: "",
    approvedUser: "",
  },
};

export function generateDefaultSchema(tenantId: string): SchemaContextType {
  return {
    tenantId,
    ...defaultScheme,
    tenant: {
      ...defaultScheme.tenant,
      contextLabels: defaultContextLabelsByTenantId(tenantId),
    },
  };
}
