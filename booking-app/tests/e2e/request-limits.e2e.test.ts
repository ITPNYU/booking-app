import { expect, test } from "@playwright/test";
import { registerBookingMocks } from "./helpers/mock-routes";
import { selectDropdown, selectTimeSlot } from "./helpers/test-utils";

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

test.describe("Request Limits", () => {
  test.beforeEach(async ({ page }) => {
    await registerBookingMocks(page);
  });

  test("blocks Next on /selectRoom and shows the server's 429 message when the limit is reached", async ({
    page,
  }) => {
    const limitMessage =
      'Request limit reached for "Lecture Hall 202" (perDay). Limit: 1.';

    let requestLimitCalled = false;
    await page.route("**/api/bookings/request-limits", async (route) => {
      requestLimitCalled = true;
      return route.fulfill({
        status: 429,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ok: false, error: limitMessage }),
      });
    });

    await page.goto(`${BASE_URL}/mc`, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle");
    const requestBtn = page.getByRole("button", {
      name: /Request a Reservation/i,
    });
    await requestBtn.waitFor({ state: "visible", timeout: 15000 });
    await requestBtn.click();

    await page.waitForURL("**/mc/book", { timeout: 15000 });
    await page.waitForLoadState("networkidle");
    const acceptBtn = page.getByRole("button", { name: /^I accept$/i });
    await acceptBtn.waitFor({ state: "visible", timeout: 10000 });
    await acceptBtn.click();

    await page.waitForURL("**/mc/book/role", { timeout: 15000 });
    await page.waitForLoadState("networkidle");
    await selectDropdown(page, "school-select", 0);
    await selectDropdown(page, "department-select", 0);
    await selectDropdown(page, "role-select", 1); // Faculty
    await page.getByRole("button", { name: "Next", exact: true }).click();

    await page.waitForURL("**/mc/book/selectRoom", { timeout: 15000 });
    await selectTimeSlot(page, "202");

    // Wait for the /api/bookings/request-limits call to land. The hook fires
    // once both a room and a time slot are selected.
    await expect
      .poll(() => requestLimitCalled, { timeout: 15000 })
      .toBe(true);

    const alert = page.getByRole("alert").filter({ hasText: limitMessage });
    await expect(alert).toBeVisible({ timeout: 10000 });

    const nextBtn = page.getByRole("button", { name: "Next", exact: true });
    await expect(nextBtn).toBeDisabled();
  });
});
