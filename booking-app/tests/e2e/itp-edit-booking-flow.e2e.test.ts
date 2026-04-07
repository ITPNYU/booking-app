import { expect, test } from "@playwright/test";
import { registerItpBookingMocks } from "./helpers/itp-mock-routes";

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
const CALENDAR_EVENT_ID = "mock-itp-edit-event-123";

test.describe("ITP Edit Booking Flow", () => {
  test.beforeEach(async ({ page }) => {
    await registerItpBookingMocks(page);
  });

  test("edit landing page shows policy warning and Start button", async ({
    page,
  }) => {
    await page.goto(`${BASE_URL}/itp/edit/${CALENDAR_EVENT_ID}`, {
      waitUntil: "domcontentloaded",
    });
    await page.waitForLoadState("networkidle");

    // Verify policy text is shown
    const policyText = page.getByText(/restart the approval process/i);
    await policyText.waitFor({ state: "visible", timeout: 15000 });
    await expect(policyText).toBeVisible();

    // Verify Start button is visible
    const startBtn = page.getByRole("button", { name: "Start" });
    await expect(startBtn).toBeVisible();
  });
});
