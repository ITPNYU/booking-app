import { Page, Route } from "@playwright/test";

const mockItpTenantSchema = {
  tenant: "itp",
  name: "ITP",
  logo: "/itpLogo.svg",
  nameForPolicy: "ITP",
  policy: "<p>Mock ITP policy content for automated tests.</p>",
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
    { id: "checklist", html: "<p>Mock ITP checklist agreement.</p>" },
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
};

const mockIdentityResponse = {
  affiliations: ["ITP"],
  roles: ["Admin"],
  displayName: "ITP Admin",
  email: "itpadmin@nyu.edu",
};

const mockBookingResponse = {
  success: true,
  booking: {
    requestNumber: 20001,
    status: "REQUESTED",
  },
};

const mockSafetyTraining = {
  emails: ["test@nyu.edu"],
};

const jsonHeaders = {
  "content-type": "application/json",
};

export { mockItpTenantSchema };

export async function registerItpBookingMocks(page: Page) {
  // Set environment variables for test mode
  await page.addInitScript(() => {
    (window as any).process = (window as any).process || {};
    (window as any).process.env = (window as any).process.env || {};
    (window as any).process.env.BYPASS_AUTH = "true";
    (window as any).process.env.E2E_TESTING = "true";
    (window as any).process.env.NEXT_PUBLIC_BASE_URL = "http://localhost:3000";
  });

  await page.route("**/api/isTestEnv", (route) =>
    route.fulfill({
      status: 200,
      headers: jsonHeaders,
      body: JSON.stringify({ isOnTestEnv: true }),
    })
  );

  await page.route("**/api/tenantSchema/itp", (route) =>
    route.fulfill({
      status: 200,
      headers: jsonHeaders,
      body: JSON.stringify(mockItpTenantSchema),
    })
  );

  await page.route("**/api/safety_training_users**", (route) =>
    route.fulfill({
      status: 200,
      headers: jsonHeaders,
      body: JSON.stringify(mockSafetyTraining),
    })
  );

  await page.route("**/api/safety_training_form**", (route) =>
    route.fulfill({
      status: 200,
      headers: jsonHeaders,
      body: JSON.stringify({}),
    })
  );

  await page.route("**/api/nyu/identity/**", (route) =>
    route.fulfill({
      status: 200,
      headers: jsonHeaders,
      body: JSON.stringify(mockIdentityResponse),
    })
  );

  await page.route("**/api/calendarEvents**", (route) =>
    route.fulfill({
      status: 200,
      headers: jsonHeaders,
      body: JSON.stringify([]),
    })
  );

  await page.route("**/api/bookings", async (route: Route) => {
    if (route.request().method() === "POST") {
      return route.fulfill({
        status: 200,
        headers: jsonHeaders,
        body: JSON.stringify(mockBookingResponse),
      });
    }
    return route.fulfill({
      status: 200,
      headers: jsonHeaders,
      body: JSON.stringify([]),
    });
  });

  await page.route("**/api/bookingsDirect", async (route: Route) => {
    if (route.request().method() === "POST") {
      return route.fulfill({
        status: 200,
        headers: jsonHeaders,
        body: JSON.stringify({
          success: true,
          booking: {
            requestNumber: 20002,
            status: "APPROVED",
          },
        }),
      });
    }
    return route.fulfill({
      status: 200,
      headers: jsonHeaders,
      body: JSON.stringify([]),
    });
  });

  await page.route("**/api/services**", (route) =>
    route.fulfill({
      status: 200,
      headers: jsonHeaders,
      body: JSON.stringify({ services: [] }),
    })
  );

  // Mock Firebase Firestore operations
  await page.route("**/firestore.googleapis.com/**", (route) =>
    route.fulfill({
      status: 200,
      headers: jsonHeaders,
      body: JSON.stringify({ documents: [] }),
    })
  );

  // Mock Google Auth endpoints
  await page.route("**/accounts.google.com/**", (route) =>
    route.fulfill({
      status: 200,
      headers: jsonHeaders,
      body: JSON.stringify({}),
    })
  );

  // Mock Firebase Auth endpoints
  await page.route("**/identitytoolkit.googleapis.com/**", (route) =>
    route.fulfill({
      status: 200,
      headers: jsonHeaders,
      body: JSON.stringify({}),
    })
  );

  // Mock any other Firebase-related endpoints
  await page.route("**/firebase.googleapis.com/**", (route) =>
    route.fulfill({
      status: 200,
      headers: jsonHeaders,
      body: JSON.stringify({}),
    })
  );
}
