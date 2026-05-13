import { Page, Route } from "@playwright/test";
import { getTestTenantSchema } from "@/lib/utils/testTenantSchema";

export const mockTenantSchema = getTestTenantSchema("mc");

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

  // After the SSO migration, browser-side Firestore reads/writes go through
  // /api/firestore/* which proxies via firebase-admin. CI has no service
  // account credentials, so the real route returns 500. Stub them with the
  // shapes Provider.tsx expects so per-page mocks (registered after this
  // helper) can still take precedence for endpoints they care about.
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
