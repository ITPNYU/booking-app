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

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

test.describe("ITP Blackout Periods – booking blocked", () => {
  test("blocks ITP booking when date falls within a blackout period", async ({
    page,
  }) => {
    await registerItpBookingMocks(page);
    await registerDefinePropertyInterceptor(page);

    // Inject blackout period covering tomorrow (all day) for room 408
    await page.addInitScript(() => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const start = new Date(tomorrow);
      start.setHours(0, 0, 0, 0);
      const end = new Date(tomorrow);
      end.setHours(23, 59, 59, 999);

      const makeTimestamp = (d: Date) => ({
        toDate: () => new Date(d),
        toMillis: () => d.getTime(),
        valueOf: () => d.getTime(),
      });

      const mockBlackoutPeriods = [
        {
          id: "itp-blackout-1",
          name: "ITP Test Blackout",
          startDate: makeTimestamp(start),
          endDate: makeTimestamp(end),
          isActive: true,
          roomIds: [408],
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
        if (normalized.includes("blackout")) {
          return mockBlackoutPeriods;
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

    // Room & time selection – select room 408 and tomorrow's timeslot
    await page.waitForURL("**/itp/book/selectRoom", { timeout: 15000 });
    await itpSelectTimeSlot(page, "408");
    await page.waitForTimeout(500);

    // Verify blackout alert is shown
    const alert = page.getByRole("alert").filter({
      hasText: /blackout period/i,
    });
    await alert.waitFor({ state: "visible", timeout: 10000 });
    await expect(alert).toBeVisible();

    // Verify Next button is disabled
    const nextBtn = page.getByRole("button", { name: "Next", exact: true });
    await expect(nextBtn).toBeDisabled();
  });
});
