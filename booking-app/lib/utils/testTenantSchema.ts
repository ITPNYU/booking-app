import {
  SchemaContextType,
  defaultSafetyTrainingInfoUrl,
} from "@/components/src/client/routes/components/SchemaProvider";

/**
 * Mock tenant schema used in e2e tests when BYPASS_AUTH is enabled.
 * This avoids hitting the real database (Firebase Admin) during test runs.
 */
export function getTestTenantSchema(tenant: string): SchemaContextType {
  if (tenant === "itp") {
    return getItpTestSchema();
  }
  return getMcTestSchema(tenant);
}

function getMcTestSchema(tenant: string): SchemaContextType {
  return {
    tenant,
    name: "Media Commons",
    logo: "/mediaCommonsLogo.svg",
    nameForPolicy: "370J Media Commons",
    policy: "<p>Test policy.</p>",
    schoolMapping: {
      "Tisch School of the Arts": ["ITP / IMA / Low Res", "General Department"],
    },
    programMapping: {
      "ITP / IMA / Low Res": ["ITP"],
      "General Department": ["GENERAL"],
    },
    roles: ["Student", "Faculty", "Staff"],
    roleMapping: {
      Student: ["STUDENT"],
      Faculty: ["FACULTY"],
      Staff: ["STAFF"],
    },
    showNNumber: true,
    showSponsor: true,
    showSetup: false,
    showEquipment: false,
    showStaffing: false,
    showCatering: false,
    showHireSecurity: false,
    showBookingTypes: true,
    bookingTypes: [
      "Class Session",
      "General Event",
      "Meeting",
      "Workshop",
      "Presentation",
      "Rehearsal",
    ],
    attendeeAffiliations: [
      "NYU Members with an active NYU ID",
      "Non-NYU guests",
      "All of the above",
    ],
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
        trainingInfoUrl: "",
        shouldAutoApprove: true,
        isWalkIn: false,
        isWalkInCanBookTwo: false,
        services: [],
      },
      {
        capacity: 20,
        name: "Studio 220",
        roomId: 220,
        isEquipment: false,
        calendarId: "mock-calendar-220",
        needsSafetyTraining: false,
        trainingInfoUrl: "",
        shouldAutoApprove: false,
        isWalkIn: true,
        isWalkInCanBookTwo: false,
        services: [],
      },
      {
        capacity: 25,
        name: "Seminar 203",
        roomId: 203,
        isEquipment: false,
        calendarId: "mock-calendar-203",
        needsSafetyTraining: false,
        trainingInfoUrl: "",
        shouldAutoApprove: false,
        isWalkIn: false,
        isWalkInCanBookTwo: false,
        services: [],
        maxHour: { faculty: 0.5 },
      },
      {
        capacity: 15,
        name: "Workshop 230",
        roomId: 230,
        isEquipment: false,
        calendarId: "mock-calendar-230",
        needsSafetyTraining: true,
        trainingInfoUrl: defaultSafetyTrainingInfoUrl,
        shouldAutoApprove: false,
        isWalkIn: false,
        isWalkInCanBookTwo: false,
        services: [],
      },
    ],
    supportVIP: true,
    supportWalkIn: true,
    resourceName: "Room(s)",
    ccEmails: {
      approved: {
        development: "booking-app-devs+approved@itp.nyu.edu",
        staging: "booking-app-devs+approved@itp.nyu.edu",
        production: "booking-app-devs+approved@itp.nyu.edu",
      },
      canceled: {
        development: "booking-app-devs+canceled@itp.nyu.edu",
        staging: "booking-app-devs+canceled@itp.nyu.edu",
        production: "booking-app-devs+canceled@itp.nyu.edu",
      },
    },
  } as unknown as SchemaContextType;
}

function getItpTestSchema(): SchemaContextType {
  return {
    tenant: "itp",
    name: "ITP",
    logo: "/itpLogo.svg",
    nameForPolicy: "ITP",
    policy: "<p>Test ITP policy.</p>",
    schoolMapping: {
      "Tisch School of the Arts": ["ITP / IMA / Low Res"],
    },
    programMapping: {
      "ITP / IMA / Low Res": ["ITP"],
    },
    roles: ["Student", "Faculty", "Admin"],
    roleMapping: {
      Student: ["STUDENT"],
      Faculty: ["FACULTY"],
      Admin: ["ADMIN"],
    },
    showNNumber: false,
    showSponsor: false,
    showSetup: false,
    showEquipment: false,
    showStaffing: false,
    showCatering: false,
    showHireSecurity: false,
    showBookingTypes: false,
    bookingTypes: [],
    attendeeAffiliations: [
      "NYU Members with an active NYU ID",
      "Non-NYU guests",
      "All of the above",
    ],
    agreements: [
      { id: "checklist", html: "<p>ITP checklist agreement.</p>" },
      { id: "bookingPolicy", html: "<p>ITP booking policy agreement.</p>" },
    ],
    resources: [
      {
        capacity: 20,
        name: "Room 408",
        roomId: 408,
        isEquipment: false,
        calendarId: "mock-calendar-408",
        needsSafetyTraining: false,
        trainingInfoUrl: "",
        shouldAutoApprove: true,
        isWalkIn: false,
        isWalkInCanBookTwo: false,
        services: [],
        autoApproval: {
          maxHour: { student: 1, faculty: 4, admin: 4 },
          minHour: { student: 0.5, faculty: 0.5, admin: 0.5 },
        },
      },
      {
        capacity: 10,
        name: "Room 410",
        roomId: 410,
        isEquipment: false,
        calendarId: "mock-calendar-410",
        needsSafetyTraining: false,
        trainingInfoUrl: "",
        shouldAutoApprove: true,
        isWalkIn: true,
        isWalkInCanBookTwo: false,
        services: [],
        autoApproval: {
          maxHour: { student: 1, faculty: 4, admin: 4 },
          minHour: { student: 0.5, faculty: 0.5, admin: 0.5 },
        },
      },
    ],
    supportVIP: false,
    supportWalkIn: false,
    supportPA: false,
    supportLiaison: false,
    resourceName: "Room(s)",
    ccEmails: {
      approved: {
        development: "booking-app-devs+approved@itp.nyu.edu",
        staging: "booking-app-devs+approved@itp.nyu.edu",
        production: "booking-app-devs+approved@itp.nyu.edu",
      },
      canceled: {
        development: "booking-app-devs+canceled@itp.nyu.edu",
        staging: "booking-app-devs+canceled@itp.nyu.edu",
        production: "booking-app-devs+canceled@itp.nyu.edu",
      },
    },
  } as unknown as SchemaContextType;
}
