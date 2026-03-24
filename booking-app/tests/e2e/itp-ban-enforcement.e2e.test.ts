import { expect, test } from "@playwright/test";
import { registerItpBookingMocks } from "./helpers/itp-mock-routes";
import {
  registerDefinePropertyInterceptor,
  registerWebpackPatcher,
} from "./helpers/xstate-mocks";
import {
  itpNavigateToRoleSelection,
  itpSelectRole,
  itpSelectTimeSlot,
} from "./helpers/itp-test-utils";

test.describe("ITP Ban Enforcement – banned user blocked", () => {
  test("blocks banned user from booking in ITP", async ({ page }) => {
    await registerItpBookingMocks(page);
    await registerDefinePropertyInterceptor(page);

    // Inject banned user data for the test user (test@nyu.edu)
    await page.addInitScript(() => {
      const makeTimestamp = (d: Date) => ({
        toDate: () => new Date(d),
        toMillis: () => d.getTime(),
        valueOf: () => d.getTime(),
      });

      const mockBannedUsers = [
        {
          id: "itp-ban-1",
          email: "test@nyu.edu",
          bannedAt: new Date().toISOString(),
          createdAt: makeTimestamp(new Date()),
        },
      ];

      const original = (window as any).clientFetchAllDataFromCollection;

      (window as any).clientFetchAllDataFromCollection = async function (
        tableName: string,
        constraints: unknown[],
        tenant: string,
      ) {
        const normalized = tableName ? tableName.toLowerCase() : "";
        if (normalized.includes("banned")) {
          return mockBannedUsers;
        }
        if (original) {
          return await original(tableName, constraints, tenant);
        }
        return [];
      };
    });

    await registerWebpackPatcher(page);

    await itpNavigateToRoleSelection(page);

    // Faculty = index 1
    await itpSelectRole(page, { roleIndex: 1 });
    await page.getByRole("button", { name: "Next", exact: true }).click();

    // Room & time selection
    await page.waitForURL("**/itp/book/selectRoom", { timeout: 15000 });
    await itpSelectTimeSlot(page, "408");
    await page.waitForTimeout(500);

    // Verify banned alert is shown
    const alert = page.getByRole("alert").filter({
      hasText: /banned from booking/i,
    });
    await alert.waitFor({ state: "visible", timeout: 10000 });
    await expect(alert).toBeVisible();

    // Verify Next button is disabled
    const nextBtn = page.getByRole("button", { name: "Next", exact: true });
    await expect(nextBtn).toBeDisabled();
  });
});
