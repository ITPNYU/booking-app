import { SchemaContextType } from "../client/routes/components/SchemaProvider";
import { TENANTS } from "../constants/tenants";

const baseMediaCommonsSchema: SchemaContextType = {
  tenant: TENANTS.MC,
  name: "Media Commons",
  logo: "/mediaCommonsLogo.svg",
  nameForPolicy: "370J Media Commons",
  policy: "<p>Mock policy content for automated tests.</p>",
  programMapping: {
    "ITP / IMA / Low Res": ["ITP"],
    "General Department": ["GENERAL"],
  },
  schoolOptions: [
    "Tisch School of the Arts",
    "Tandon School of Engineering",
    "Stern School of Business",
    "Steinhardt School of Culture, Education, and Human Development",
    "College of Arts & Science",
  ],
  departmentToSchool: {
    "ITP / IMA / Low Res": "Tisch School of the Arts",
    "General Department": "College of Arts & Science",
  },
  roles: ["Student", "Faculty", "Staff"],
  roleMapping: {
    Student: ["STUDENT"],
    Faculty: ["FACULTY"],
    Staff: ["STAFF"],
  },
  showNNumber: true,
  showSponsor: true,
  showSetup: true,
  showEquipment: true,
  showStaffing: true,
  showCatering: true,
  showHireSecurity: true,
  showBookingTypes: true,
  agreements: [
    { id: "checklist", html: "<p>Mock checklist agreement.</p>" },
    { id: "resetRoom", html: "<p>Reset room agreement.</p>" },
    { id: "bookingPolicy", html: "<p>Booking policy agreement.</p>" },
  ],
  resources: [
    {
      capacity: 30,
      name: "Lecture Hall 202",
      roomId: 202,
      isEquipment: false,
      calendarId: "mock-calendar-202",
      needsSafetyTraining: false,
      shouldAutoApprove: true,
      isWalkIn: false,
      isWalkInCanBookTwo: false,
      services: [],
      minHour: {
        student: 1,
        faculty: 1,
        admin: 1,
        studentWalkIn: 1,
        facultyWalkIn: 1,
        adminWalkIn: 1,
      },
      maxHour: {
        student: 4,
        faculty: 8,
        admin: 12,
        studentWalkIn: 4,
        facultyWalkIn: 8,
        adminWalkIn: 12,
      },
    },
    {
      capacity: 20,
      name: "Studio 220",
      roomId: 220,
      isEquipment: false,
      calendarId: "mock-calendar-220",
      needsSafetyTraining: false,
      shouldAutoApprove: false,
      isWalkIn: true,
      isWalkInCanBookTwo: false,
      services: [],
      minHour: {
        student: 1,
        faculty: 1,
        admin: 1,
        studentWalkIn: 1,
        facultyWalkIn: 1,
        adminWalkIn: 1,
      },
      maxHour: {
        student: 3,
        faculty: 6,
        admin: 10,
        studentWalkIn: 3,
        facultyWalkIn: 6,
        adminWalkIn: 10,
      },
    },
  ],
  supportVIP: true,
  supportWalkIn: true,
  resourceName: "Room(s)",
  emailMessages: {
    requestConfirmation: "Your booking request has been received.",
    firstApprovalRequest: "A booking requires your approval.",
    secondApprovalRequest: "A booking requires second approval.",
    walkInConfirmation: "Your walk-in booking has been confirmed.",
    vipConfirmation: "Your VIP booking has been confirmed.",
    checkoutConfirmation: "You have successfully checked out.",
    checkinConfirmation: "You have successfully checked in.",
    declined: "Your booking request has been declined.",
    canceled: "Your booking has been canceled.",
    lateCancel: "Your booking has been canceled late.",
    noShow: "You have been marked as no-show.",
    closed: "Your booking has been closed.",
    approvalNotice: "Your booking has been approved.",
  },
};

const schemaByTenant: Record<string, SchemaContextType> = {
  [TENANTS.MC]: baseMediaCommonsSchema,
  [TENANTS.MEDIA_COMMONS]: {
    ...baseMediaCommonsSchema,
    tenant: TENANTS.MEDIA_COMMONS,
  },
};

export const getTestTenantSchema = (
  tenant: string
): SchemaContextType | null => {
  return schemaByTenant[tenant] ?? null;
};
