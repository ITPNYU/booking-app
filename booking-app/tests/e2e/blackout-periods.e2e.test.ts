import { expect, test } from "@playwright/test";
import { registerBookingMocks } from "./helpers/mock-routes";
import {
  mockFirestoreListCollections,
  selectRole,
  selectTimeSlot,
  serializedTimestamp,
} from "./helpers/test-utils";

const BASE_URL =
  process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

test.describe("Blackout Periods – booking blocked", () => {
  test("blocks booking when date falls within a blackout period", async ({
    page,
  }) => {
    await registerBookingMocks(page);

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const start = new Date(tomorrow);
    start.setHours(0, 0, 0, 0);
    const end = new Date(tomorrow);
    end.setHours(23, 59, 59, 999);

    // Mock blackout period covering tomorrow (all day) for room 202.
    await mockFirestoreListCollections(page, [
      {
        collection: "blackoutPeriods",
        docs: [
          {
            id: "blackout-1",
            name: "Test Blackout",
            startDate: serializedTimestamp(start),
            endDate: serializedTimestamp(end),
            isActive: true,
            roomIds: [202],
            createdAt: serializedTimestamp(new Date()),
          },
        ],
      },
    ]);

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

    // Role selection (Faculty)
    await page.waitForURL("**/mc/book/role", { timeout: 15000 });
    await page.waitForLoadState("networkidle");
    await selectRole(page, { roleIndex: 1 });
    await page.getByRole("button", { name: "Next", exact: true }).click();

    // Room & time selection – select room 202 and tomorrow's timeslot
    await page.waitForURL("**/mc/book/selectRoom", { timeout: 15000 });
    await selectTimeSlot(page, "202");
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
