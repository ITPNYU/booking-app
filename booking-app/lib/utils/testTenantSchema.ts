import { SchemaContextType } from "@/components/src/client/routes/components/SchemaProvider";

/**
 * Mock tenant schema used in e2e tests when BYPASS_AUTH is enabled.
 * This avoids hitting the real database (Firebase Admin) during test runs.
 */
export function getTestTenantSchema(tenant: string): SchemaContextType {
  return {
    tenant,
    name: "Media Commons",
    logo: "/mediaCommonsLogo.svg",
    nameForPolicy: "370J Media Commons",
    policy: "<p>Test policy.</p>",
    schoolMapping: {
      "Tisch School of the Arts": [
        "ITP / IMA / Low Res",
        "General Department",
      ],
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
        shouldAutoApprove: true,
        isWalkIn: false,
        isWalkInCanBookTwo: false,
        services: [],
      },
    ],
    supportVIP: true,
    supportWalkIn: true,
    resourceName: "Room(s)",
  } as unknown as SchemaContextType;
}
