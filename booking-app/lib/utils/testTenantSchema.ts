import { defaultSafetyTrainingInfoUrl } from "@/components/src/constants/safetyTraining";
import {
  defaultResource,
  generateDefaultSchema,
  type Resource,
  type SchemaContextType,
} from "@/components/src/client/routes/components/SchemaProvider";

function resource(over: Partial<Resource>): Resource {
  return {
    ...defaultResource,
    ...over,
    training: {
      ...defaultResource.training,
      ...over.training,
    },
  };
}

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
  const base = generateDefaultSchema(tenant === "mc" ? "mc" : tenant);
  return {
    ...base,
    tenant: {
      ...base.tenant,
      name: "Media Commons",
      logo: "/mediaCommonsLogo.svg",
      nameForPolicy: "370J Media Commons",
    },
    policy: "<p>Test policy.</p>",
    mappings: {
      school: {
        "Tisch School of the Arts": ["ITP / IMA / Low Res", "General Department"],
      },
      program: {
        "ITP / IMA / Low Res": ["ITP"],
        "General Department": ["GENERAL"],
      },
      role: {
        Student: ["STUDENT"],
        Faculty: ["FACULTY"],
        Staff: ["STAFF"],
      },
    },
    roles: ["Student", "Faculty", "Staff"],
    form: {
      ...base.form,
      showNNumber: true,
      showSponsor: true,
      services: {
        showCatering: false,
        showEquipment: false,
        showSecurity: false,
        showSetup: false,
        showStaffing: false,
      },
    },
    attestations: [
      { id: "checklist", html: "<p>Mock checklist agreement.</p>" },
      { id: "resetRoom", html: "<p>Reset room agreement.</p>" },
      { id: "bookingPolicy", html: "<p>Booking policy agreement.</p>" },
    ],
    resources: [
      resource({
        capacity: 30,
        name: "Lecture Hall 202",
        roomId: 202,
        calendarId: "mock-calendar-202",
        isWalkIn: false,
        autoApproval: { shouldAutoApprove: true },
      }),
      resource({
        capacity: 20,
        name: "Studio 220",
        roomId: 220,
        calendarId: "mock-calendar-220",
        isWalkIn: true,
        autoApproval: { shouldAutoApprove: false },
      }),
      resource({
        capacity: 25,
        name: "Seminar 203",
        roomId: 203,
        calendarId: "mock-calendar-203",
        isWalkIn: false,
        maxHour: { ...defaultResource.maxHour, faculty: 0.5 },
        autoApproval: { shouldAutoApprove: false },
      }),
      resource({
        capacity: 15,
        name: "Workshop 230",
        roomId: 230,
        calendarId: "mock-calendar-230",
        isWalkIn: false,
        training: {
          required: true,
          formId:
            "https://docs.google.com/forms/d/e/e2e-mock-safety-form/viewform",
          infoUrl: defaultSafetyTrainingInfoUrl,
        },
        autoApproval: { shouldAutoApprove: false },
      }),
    ],
    origins: {
      VIP: true,
      walkIn: true,
    },
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
  };
}

function getItpTestSchema(): SchemaContextType {
  const base = generateDefaultSchema("itp");
  return {
    ...base,
    tenant: {
      ...base.tenant,
      name: "ITP",
      logo: "/itpLogo.svg",
      nameForPolicy: "ITP",
    },
    policy: "<p>Test ITP policy.</p>",
    mappings: {
      school: {
        "Tisch School of the Arts": ["ITP / IMA / Low Res"],
      },
      program: {
        "ITP / IMA / Low Res": ["ITP"],
      },
      role: {
        Student: ["STUDENT"],
        Faculty: ["FACULTY"],
        Admin: ["ADMIN"],
      },
    },
    roles: ["Student", "Faculty", "Admin"],
    form: {
      ...base.form,
      showBookingType: false,
      showNNumber: false,
      showSponsor: false,
      services: {
        showCatering: false,
        showEquipment: false,
        showSecurity: false,
        showSetup: false,
        showStaffing: false,
      },
    },
    attestations: [
      { id: "checklist", html: "<p>ITP checklist agreement.</p>" },
      { id: "bookingPolicy", html: "<p>ITP booking policy agreement.</p>" },
    ],
    resources: [
      resource({
        capacity: 20,
        name: "Room 408",
        roomId: 408,
        calendarId: "mock-calendar-408",
        isWalkIn: false,
        autoApproval: {
          shouldAutoApprove: true,
          maxHour: { student: 1, faculty: 4, admin: 4 },
          minHour: { student: 0.5, faculty: 0.5, admin: 0.5 },
        },
      }),
      resource({
        capacity: 10,
        name: "Room 410",
        roomId: 410,
        calendarId: "mock-calendar-410",
        isWalkIn: true,
        autoApproval: {
          shouldAutoApprove: true,
          maxHour: { student: 1, faculty: 4, admin: 4 },
          minHour: { student: 0.5, faculty: 0.5, admin: 0.5 },
        },
      }),
    ],
    origins: {
      VIP: false,
      walkIn: false,
    },
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
  };
}
