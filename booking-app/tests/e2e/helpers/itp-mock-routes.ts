import { Page, Route } from "@playwright/test";
import { getTestTenantSchema } from "@/lib/utils/testTenantSchema";

/** Nested canonical tenant schema (same shape as GET /api/tenantSchema/itp). */
const mockItpTenantSchema = getTestTenantSchema("itp");

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
      body: JSON.stringify({ emails: [] }),
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

  // After the SSO migration, browser-side Firestore reads/writes go through
  // /api/firestore/* which proxies via firebase-admin. CI has no service
  // account credentials, so the real route returns 500. Stub them with the
  // shapes Provider.tsx expects.
  await page.route("**/api/firestore/list", (route) =>
    route.fulfill({
      status: 200,
      headers: jsonHeaders,
      body: JSON.stringify({ docs: [] }),
    })
  );
  await page.route("**/api/firestore/getDoc", (route) =>
    route.fulfill({
      status: 200,
      headers: jsonHeaders,
      body: JSON.stringify({ doc: null }),
    })
  );
  await page.route("**/api/firestore/paginated", (route) =>
    route.fulfill({
      status: 200,
      headers: jsonHeaders,
      body: JSON.stringify({ docs: [] }),
    })
  );
  await page.route("**/api/firestore/mutate", (route) =>
    route.fulfill({
      status: 200,
      headers: jsonHeaders,
      body: JSON.stringify({ id: "mock-doc-id", ok: true }),
    })
  );
  await page.route("**/api/firestore/userRights", (route) =>
    route.fulfill({
      status: 200,
      headers: jsonHeaders,
      body: JSON.stringify({ id: "mock-doc-id", ok: true }),
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
