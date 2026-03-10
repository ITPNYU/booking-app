import { expect, test } from "@playwright/test";
import { registerBookingMocks } from "./helpers/mock-routes";
import {
  registerDefinePropertyInterceptor,
  registerWebpackPatcher,
} from "./helpers/xstate-mocks";
import { selectRole, selectTimeSlot } from "./helpers/test-utils";

const BASE_URL =
  process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

test.describe("Safety Training – untrained student blocked", () => {
  test("blocks untrained student from booking rooms requiring safety training", async ({
    page,
  }) => {
    // Room 230 (needsSafetyTraining: true) is already in the base test schema.
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
    });

    await registerWebpackPatcher(page);

    // Override identity to return Student affiliations
    await page.route("**/api/nyu/identity/**", (route) =>
      route.fulfill({
        status: 200,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          affiliations: ["ITP"],
          roles: ["Student"],
          displayName: "Test Student",
          email: "test@nyu.edu",
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
