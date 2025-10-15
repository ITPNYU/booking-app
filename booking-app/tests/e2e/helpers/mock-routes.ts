import { Page, Route } from "@playwright/test";

const mockTenantSchema = {
  tenant: "mc",
  name: "Media Commons",
  logo: "/mediaCommonsLogo.svg",
  nameForPolicy: "370J Media Commons",
  policy: "<p>Mock policy content for automated tests.</p>",
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
  showSetup: true,
  showEquipment: true,
  showStaffing: true,
  showCatering: true,
  showHireSecurity: true,
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
      shouldAutoApprove: false,
      isWalkIn: true,
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
  roles: ["Student"],
  displayName: "Test User",
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
  // Simple approach: Mock the settings initial value
  await page.addInitScript(() => {
    const mockBookingTypesData = [
      { bookingType: "Class Session", createdAt: "2024-01-01T00:00:00Z" },
      { bookingType: "General Event", createdAt: "2024-01-01T00:00:00Z" },
      { bookingType: "Meeting", createdAt: "2024-01-01T00:00:00Z" },
      { bookingType: "Workshop", createdAt: "2024-01-01T00:00:00Z" },
    ];

    // Store mock data globally for access
    (window as any).mockBookingTypes = mockBookingTypesData;

    // Override Firestore SDK functions directly
    (window as any).getDocs = function(queryRef) {
      console.log("🔥 Mock getDocs called");
      // Check if this is for booking types based on the collection name
      if (queryRef && (queryRef._path || queryRef.path)) {
        const path = queryRef._path || queryRef.path;
        console.log("🔥 getDocs path:", path);
        if (path && (path.includes('bookingTypes') || path.includes('mc-bookingTypes'))) {
          console.log("🎯 Returning mock booking types from getDocs");
          return Promise.resolve({
            docs: mockBookingTypesData.map((item, index) => ({
              id: `booking-type-${index + 1}`,
              data: () => item,
            })),
          });
        }
      }
      return Promise.resolve({ docs: [] });
    };

    // Also override collection and query functions
    (window as any).collection = function(db, path) {
      console.log("🔥 Mock collection called with path:", path);
      return { _path: path, path: path };
    };

    (window as any).query = function(collectionRef, ...constraints) {
      console.log("🔥 Mock query called");
      return collectionRef;
    };

    // Override Firebase client function as fallback
    (window as any).clientFetchAllDataFromCollection = function (
      tableName,
      constraints,
      tenant
    ) {
      console.log(
        `🔥 Mock clientFetchAllDataFromCollection called: ${tableName}, tenant: ${tenant}`
      );
      if (
        tableName === "bookingTypes" ||
        tableName.includes("bookingTypes") ||
        tableName.includes("BOOKING_TYPES")
      ) {
        console.log("🎯 Returning mock booking types data");
        // Return data with id field as expected by fetchBookingTypes function
        return Promise.resolve(
          mockBookingTypesData.map((item, index) => ({
            id: `booking-type-${index + 1}`,
            ...item,
          }))
        );
      }
      return Promise.resolve([]);
    };

    // Also try to override module imports using dynamic import interception
    const originalImport =
      (window as any).__webpack_require__ || (window as any).require;
    if (originalImport) {
      (window as any).__webpack_require__ = function (moduleId) {
        const result = originalImport.apply(this, arguments);
        if (result && result.clientFetchAllDataFromCollection) {
          console.log(
            "🔥 Intercepting webpack module with clientFetchAllDataFromCollection"
          );
          result.clientFetchAllDataFromCollection = (
            window as any
          ).clientFetchAllDataFromCollection;
        }
        return result;
      };
    }

    // Wait for React to load and override the settings useState as fallback
    setTimeout(() => {
      console.log(
        "🎯 Attempting to override settings initial value as fallback"
      );

      // Try to find and override React useState for settings
      if ((window as any).React && (window as any).React.useState) {
        const originalUseState = (window as any).React.useState;
        (window as any).React.useState = function (initialState) {
          // If this looks like the settings useState call (has bookingTypes property)
          if (
            initialState &&
            typeof initialState === "object" &&
            "bookingTypes" in initialState &&
            Array.isArray(initialState.bookingTypes)
          ) {
            console.log(
              "🔥 Intercepting settings useState, providing mock booking types"
            );
            return originalUseState({
              ...initialState,
              bookingTypes: mockBookingTypesData,
            });
          }
          return originalUseState.apply(this, arguments);
        };
      }
    }, 1000);
  });

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
