import { expect, test } from "@playwright/test";
import { registerBookingMocks } from "./helpers/mock-routes";
import {
  selectTimeSlot,
  selectRole,
  fillBookingForm,
} from "./helpers/test-utils";

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

test.describe("VIP Booking Flow", () => {
  test.beforeEach(async ({ page }) => {
    await registerBookingMocks(page);
  });

  test("should complete a VIP booking from start to confirmation", async ({
    page,
  }) => {
    // ── 1. VIP Landing page ──
    await page.goto(`${BASE_URL}/mc/vip`, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle");

    const startBtn = page.getByRole("button", { name: /Start/i });
    await startBtn.waitFor({ state: "visible", timeout: 15000 });
    await startBtn.click();

    // ── 2. Role selection page (no NetID step for VIP) ──
    await page.waitForURL("**/mc/vip/role", { timeout: 15000 });
    await page.waitForLoadState("networkidle");

    // School → Department → Role (Faculty = index 1)
    await selectRole(page, { roleIndex: 1 });

    await page.getByRole("button", { name: "Next", exact: true }).click();

    // ── 3. Room & time selection ──
    await page.waitForURL("**/mc/vip/selectRoom", { timeout: 15000 });

    // VIP can use any room; use room 202
    await selectTimeSlot(page, "202");

    await page.waitForTimeout(500);

    const nextBtn = page.getByRole("button", { name: "Next", exact: true });
    await nextBtn.waitFor({ state: "visible", timeout: 10000 });
    await nextBtn.click();

    // ── 4. Form details page ──
    await page.waitForURL("**/mc/vip/form", { timeout: 15000 });
    await page.waitForLoadState("networkidle");

    // VIP: nNumber is hidden, agreements need manual checking
    await fillBookingForm(page, {
      firstName: "VIP",
      lastName: "Guest",
      netId: "vip789",
      skipNNumber: true,
      checkAgreements: true,
    });

    // ── 5. Submit ──
    await page.getByRole("button", { name: "Submit" }).click();

    // ── 6. Confirmation page ──
    await page.waitForURL("**/mc/vip/confirmation", { timeout: 15000 });

    const heading = page.getByText(/VIP request submitted/i);
    await heading.waitFor({ state: "visible", timeout: 30000 });
    await expect(heading).toBeVisible();
  });
});
