import { test, type Page } from "@playwright/test";
import {
  expectWithinApiBudget,
  recordApiRequests,
  type ApiCallCounts,
} from "./helpers/api-request-recorder";
import { registerBookingMocks } from "./helpers/mock-routes";

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
const TEST_EMAIL = "test@nyu.edu";

type Role = "BOOKING" | "PA" | "LIAISON" | "ADMIN";

/**
 * Answer /api/permissions as the given role. The window-level
 * `__bookingE2EMocks` shortcut is deliberately not used here: it skips the
 * network, and the network is what this suite measures.
 */
async function mockPermissions(page: Page, role: Role) {
  const user = { id: "mock-user", email: TEST_EMAIL, createdAt: "2026-01-01" };
  const body = {
    pagePermission: role,
    adminUsers: role === "ADMIN" ? [user] : [],
    paUsers: role === "PA" ? [user] : [],
    liaisonUsers:
      role === "LIAISON" ? [{ ...user, department: "ITP", level: 1 }] : [],
    equipmentUsers: [],
    superAdminUsers: [],
    policySettings: { finalApproverEmail: "" },
  };
  await page.route("**/api/permissions**", (route) =>
    route.fulfill({
      status: 200,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

interface Scenario {
  name: string;
  role: Role;
  path: string;
  /** Upper bound per call. A call that is not listed has a budget of 0. */
  budget: ApiCallCounts;
}

// Calls every page makes today. Two of them are known waste: /api/permissions
// is fetched three times per load, and /api/calendarEvents is fetched on pages
// that show no calendar.
const EVERY_PAGE: ApiCallCounts = {
  "GET /api/permissions": 3,
  "GET /api/nyu/identity/test": 1,
  "GET /api/calendarEvents": 1,
};

// Reference data Provider.tsx loads on the routes that use booking data.
const BOOKING_DATA: ApiCallCounts = {
  "POST /api/firestore/list [usersBanned]": 1,
  "POST /api/firestore/list [departments]": 1,
  "POST /api/firestore/list [bookingTypes]": 1,
  "POST /api/firestore/list [operationHours]": 1,
  "POST /api/firestore/list [blackoutPeriods]": 1,
};

const BOOKINGS_TABLE: ApiCallCounts = {
  "POST /api/firestore/paginated [bookings]": 1,
};

/**
 * How many API calls each page may make while it loads.
 *
 * The numbers are what the page did when the budget was written, so they
 * record the current cost rather than an ideal one. Lower a number when a
 * page gets cheaper so the saving cannot quietly be lost again.
 */
const SCENARIOS: Scenario[] = [
  {
    name: "landing page as a booking user",
    role: "BOOKING",
    path: "/mc",
    budget: { ...EVERY_PAGE, ...BOOKINGS_TABLE },
  },
  {
    name: "admin page",
    role: "ADMIN",
    path: "/mc/admin",
    budget: { ...EVERY_PAGE, ...BOOKING_DATA, ...BOOKINGS_TABLE },
  },
  {
    name: "liaison page",
    role: "LIAISON",
    path: "/mc/liaison",
    budget: { ...EVERY_PAGE, ...BOOKING_DATA, ...BOOKINGS_TABLE },
  },
  {
    name: "PA page",
    role: "PA",
    path: "/mc/pa",
    budget: { ...EVERY_PAGE, ...BOOKING_DATA, ...BOOKINGS_TABLE },
  },
  {
    name: "start of the booking flow",
    role: "BOOKING",
    path: "/mc/book",
    budget: { ...EVERY_PAGE, ...BOOKING_DATA },
  },
];

test.describe("API call budget per page load", () => {
  for (const scenario of SCENARIOS) {
    test(scenario.name, async ({ page }, testInfo) => {
      await registerBookingMocks(page);
      await mockPermissions(page, scenario.role);
      const recorder = recordApiRequests(page);

      await page.goto(`${BASE_URL}${scenario.path}`, {
        waitUntil: "domcontentloaded",
      });
      await recorder.settle();

      await expectWithinApiBudget(testInfo, recorder.counts, scenario.budget);
    });
  }
});
