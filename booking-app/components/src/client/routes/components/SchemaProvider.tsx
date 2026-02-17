import { createContext, useContext, useEffect } from "react";

export type Agreement = {
  id: string;
  html: string;
};

export type Resource = {
  capacity: number;
  name: string;
  roomId: number;
  isEquipment: boolean; // renamed from checkable
  calendarId: string;
  needsSafetyTraining?: boolean; // Whether training is required for this resource
  trainingFormUrl?: string; // URL of the Google Form that tracks trained users
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
  staffingSections?: { name: string; indexes: number[] }[];
};

export type SchemaContextType = {
  tenant: string;
  name: string;
  safetyTrainingGoogleFormId?: string; // Lower priority: used as fallback when resource-level trainingFormUrl is not available
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
  declinedGracePeriod?: number;
  calendarConfig?: {
    startHour?: Record<string, string>; // e.g., { studentVIP: "06:00:00", student: "09:00:00", ... }
    slotUnit?: Record<string, number>; // e.g., { student: 15, admin: 15, ... }
    timeSensitiveRequestWarning?: {
      hours?: number; // hours
      isActive?: boolean;
      message?: string;
      policyLink?: string;
    };
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

export const SchemaContext = createContext<SchemaContextType>({
  tenant: "",
  name: "",
  logo: "",
  nameForPolicy: "",
  policy: "",
  roles: [],
  showNNumber: true,
  showSponsor: true,
  showHireSecurity: true,
  showSetup: true,
  showEquipment: true,
  showStaffing: true,
  showCatering: true,
  showBookingTypes: true,
  agreements: [],
  resources: [],
  supportVIP: false,
  supportWalkIn: false,
  resourceName: "",
  declinedGracePeriod: 24,
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
    timeSensitiveRequestWarning: {
      hours: 48,
      isActive: false,
      message: "",
      policyLink: "",
    },
  },
  programMapping: {},
  roleMapping: {},
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
});

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
