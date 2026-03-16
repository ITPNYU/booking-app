import { Page, Route } from "@playwright/test";

export const mockTenantSchema = {
  tenant: "mc",
  name: "Media Commons",
  logo: "/mediaCommonsLogo.svg",
  nameForPolicy: "370J Media Commons",
  policy: "<p>Mock policy content for automated tests.</p>",
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
      trainingInfoUrl:
        "https://sites.google.com/nyu.edu/370jmediacommons/reservations/safety-training",
      shouldAutoApprove: false,
      isWalkIn: false,
      isWalkInCanBookTwo: false,
      services: [],
    },
  ],
  supportVIP: true,
  supportWalkIn: true,
  resourceName: "Room(s)",
};

const mockIdentityResponse = {
  affiliations: ["ITP"],
  roles: ["Faculty"],
  displayName: "Test Faculty",
  email: "test@nyu.edu",
};

const mockBookingResponse = {
  success: true,
  booking: {
    requestNumber: 12345,
    status: "REQUESTED",
  },
};

const mockSafetyTraining = {
  emails: ["test@nyu.edu", "vip@nyu.edu", "walkin@nyu.edu"],
};

const mockBookingTypes = [
  {
    bookingType: "Class Session",
    createdAt: "2024-01-01T00:00:00Z",
  },
  {
    bookingType: "General Event",
    createdAt: "2024-01-01T00:00:00Z",
  },
  {
    bookingType: "Meeting",
    createdAt: "2024-01-01T00:00:00Z",
  },
  {
    bookingType: "Workshop",
    createdAt: "2024-01-01T00:00:00Z",
  },
];

const jsonHeaders = {
  "content-type": "application/json",
};

export async function registerBookingMocks(page: Page) {
  // Set environment variables for test mode
  await page.addInitScript(() => {
    (window as any).process = (window as any).process || {};
    (window as any).process.env = (window as any).process.env || {};
    (window as any).process.env.BYPASS_AUTH = "true";
    (window as any).process.env.E2E_TESTING = "true";
    (window as any).process.env.NEXT_PUBLIC_BASE_URL = "http://localhost:3000";
  });

  // Hide Next.js Dev Tools overlay that can obscure page elements during tests
  await page.addInitScript(() => {
    const hideDevTools = () => {
      const style = document.createElement("style");
      style.textContent =
        "nextjs-portal, #__next-build-indicator { display: none !important; }";
      (document.head || document.documentElement).appendChild(style);
    };
    if (document.head) hideDevTools();
    else document.addEventListener("DOMContentLoaded", hideDevTools);
  });

  await page.route("**/api/isTestEnv", (route) =>
    route.fulfill({
      status: 200,
      headers: jsonHeaders,
      body: JSON.stringify({ isOnTestEnv: true }),
    })
  );

  await page.route("**/api/tenantSchema/mc", (route) =>
    route.fulfill({
      status: 200,
      headers: jsonHeaders,
      body: JSON.stringify(mockTenantSchema),
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

  await page.route("**/api/calendarEvents**", (route) => {
    const url = new URL(route.request().url());
    const calendarIds = url.searchParams.get("calendarIds");
    if (calendarIds) {
      const grouped: Record<string, any[]> = {};
      for (const id of calendarIds.split(",")) {
        grouped[id] = [];
      }
      return route.fulfill({
        status: 200,
        headers: jsonHeaders,
        body: JSON.stringify(grouped),
      });
    }
    return route.fulfill({
      status: 200,
      headers: jsonHeaders,
      body: JSON.stringify([]),
    });
  });

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
            requestNumber: 12346,
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

  // Mock Firebase Firestore operations that might be called directly
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
