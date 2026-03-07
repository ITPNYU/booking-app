import { expect, test } from "@playwright/test";
import { registerBookingMocks, mockTenantSchema } from "./helpers/mock-routes";
import { registerDefinePropertyInterceptor } from "./helpers/xstate-mocks";
import { selectRole, selectTimeSlot } from "./helpers/test-utils";

const BASE_URL =
  process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

test.describe("Safety Training – untrained student blocked", () => {
  test("blocks untrained student from booking rooms requiring safety training", async ({
    page,
  }) => {
    // Create a modified tenant schema with a room that requires safety training
    const modifiedSchema = {
      ...mockTenantSchema,
      resources: [
        ...mockTenantSchema.resources,
        {
          capacity: 15,
          name: "Workshop 230",
          roomId: 230,
          isEquipment: false,
          calendarId: "mock-calendar-230",
          needsSafetyTraining: true,
          shouldAutoApprove: false,
          isWalkIn: false,
          isWalkInCanBookTwo: false,
          services: [],
        },
      ],
    };

    // Override tenant schema route before registering other mocks
    await page.route("**/api/tenantSchema/mc", (route) =>
      route.fulfill({
        status: 200,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(modifiedSchema),
      }),
    );

    await registerBookingMocks(page);

    // Override safety training to return empty list (user is NOT trained)
    await page.route("**/api/safety_training_users**", (route) =>
      route.fulfill({
        status: 200,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ emails: [] }),
      }),
    );

    await registerDefinePropertyInterceptor(page);

    // Override clientFetchAllDataFromCollection for safety training whitelist
    await page.addInitScript(() => {
      // Override safety-trained users to be empty
      (window as any).__bookingE2EMocks =
        (window as any).__bookingE2EMocks || {};
      (window as any).__bookingE2EMocks.safetyTrainedUsers = [];

      const original = (window as any).clientFetchAllDataFromCollection;

      (window as any).clientFetchAllDataFromCollection = async function (
        tableName: string,
        constraints: unknown[],
        tenant: string,
      ) {
        const normalized = tableName ? tableName.toLowerCase() : "";
        if (
          normalized.includes("whitelist") ||
          normalized.includes("safety")
        ) {
          return [];
        }
        if (original) {
          return await original(tableName, constraints, tenant);
        }
        return [];
      };

      const overrideMap: Record<string, Function> = {
        clientFetchAllDataFromCollection:
          (window as any).clientFetchAllDataFromCollection,
      };

      const patchWebpackModules = () => {
        const chunk = (window as any).webpackChunk_N_E;
        if (!chunk) return false;
        let wpRequire: any;
        try {
          chunk.push([
            ["__e2e_safety_" + Date.now()],
            {},
            (req: any) => {
              wpRequire = req;
            },
          ]);
        } catch (_) {
          return false;
        }
        if (!wpRequire?.c) return false;
        let patched = false;
        Object.values(wpRequire.c).forEach((mod: any) => {
          if (
            mod?.exports &&
            typeof mod.exports === "object" &&
            mod.exports !== null
          ) {
            for (const [key, fn] of Object.entries(overrideMap)) {
              if (key in mod.exports && fn) {
                try {
                  Object.defineProperty(mod.exports, key, {
                    value: fn,
                    writable: true,
                    configurable: true,
                    enumerable: true,
                  });
                  patched = true;
                } catch (_) {
                  try {
                    mod.exports[key] = fn;
                    patched = true;
                  } catch (_) {}
                }
              }
            }
          }
        });
        return patched;
      };

      const _earlyPatchId = setInterval(() => {
        try {
          if (patchWebpackModules()) clearInterval(_earlyPatchId);
        } catch (_) {}
      }, 2);
      setTimeout(() => clearInterval(_earlyPatchId), 10000);

      (window as any).__applyMockBookingsOverrides = () => {
        try {
          patchWebpackModules();
        } catch (_) {}
      };
    });

    // Override identity to return Student affiliations
    await page.route("**/api/nyu/identity/**", (route) =>
      route.fulfill({
        status: 200,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          affiliations: ["ITP"],
          roles: ["Student"],
          displayName: "Test Student",
          email: "tf123@nyu.edu",
        }),
      }),
    );

    // Navigate through the booking flow
    await page.goto(`${BASE_URL}/mc`, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle");

    const requestBtn = page.getByRole("button", {
      name: /Request a Reservation/i,
    });
    await requestBtn.waitFor({ state: "visible", timeout: 15000 });
    await requestBtn.click();

    // Terms
    await page.waitForURL("**/mc/book", { timeout: 15000 });
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: /^I accept$/i }).click();

    // Role selection – Student (index 0)
    await page.waitForURL("**/mc/book/role", { timeout: 15000 });
    await page.waitForLoadState("networkidle");
    await selectRole(page, { roleIndex: 0 });
    await page.getByRole("button", { name: "Next", exact: true }).click();

    // Room & time selection – select room 230 (requires safety training)
    await page.waitForURL("**/mc/book/selectRoom", { timeout: 15000 });
    await selectTimeSlot(page, "230");
    await page.waitForTimeout(500);

    // Verify safety training alert is shown
    const alert = page.getByRole("alert").filter({
      hasText: /safety training/i,
    });
    await alert.waitFor({ state: "visible", timeout: 10000 });
    await expect(alert).toBeVisible();

    // Verify Next button is disabled
    const nextBtn = page.getByRole("button", { name: "Next", exact: true });
    await expect(nextBtn).toBeDisabled();
  });
});
