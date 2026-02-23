import { expect, test } from "@playwright/test";
import { registerBookingMocks } from "./helpers/mock-routes";
import {
  selectTimeSlot,
  selectRole,
  fillBookingForm,
} from "./helpers/test-utils";

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

test.describe("Walk-In Booking Flow", () => {
  test.beforeEach(async ({ page }) => {
    await registerBookingMocks(page);
  });

  test("should complete a walk-in booking from start to confirmation", async ({
    page,
  }) => {
    // ── 1. Walk-In Landing page ──
    await page.goto(`${BASE_URL}/mc/walk-in`, {
      waitUntil: "domcontentloaded",
    });
    await page.waitForLoadState("networkidle");

    const startBtn = page.getByRole("button", { name: /Start/i });
    await startBtn.waitFor({ state: "visible", timeout: 15000 });
    await startBtn.click();

    // ── 2. NetID page ──
    await page.waitForURL("**/mc/walk-in/netid", { timeout: 15000 });
    await page.waitForLoadState("networkidle");

    // Enter walk-in visitor's NetID (2-3 letters + 1-6 digits format)
    const netIdInput = page.locator('input[name="walkInNetId"]');
    await netIdInput.waitFor({ state: "visible", timeout: 10000 });
    await netIdInput.fill("wv456");

    const nextBtn = page.getByRole("button", { name: /Next/i });
    await nextBtn.click();

    // ── 3. Role selection page ──
    await page.waitForURL("**/mc/walk-in/role", { timeout: 15000 });
    await page.waitForLoadState("networkidle");

    // School → Department → Role (Faculty = index 1, to skip sponsor)
    await selectRole(page, { roleIndex: 1 });

    await page.getByRole("button", { name: "Next" }).click();

    // ── 4. Room & time selection ──
    await page.waitForURL("**/mc/walk-in/selectRoom", { timeout: 15000 });
    await page.waitForLoadState("networkidle");

    // Walk-in: no date picker, select a future time slot on today's calendar
    // Room 220 is the walk-in room (isWalkIn: true)
    await selectTimeSlot(page, "220", { skipDatePicker: true });

    await page.waitForTimeout(500);

    const selectNextBtn = page.getByRole("button", {
      name: "Next",
      exact: true,
    });
    await selectNextBtn.waitFor({ state: "visible", timeout: 10000 });
    await selectNextBtn.click();

    // ── 5. Form details page ──
    await page.waitForURL("**/mc/walk-in/form", { timeout: 15000 });
    await page.waitForLoadState("networkidle");

    // Walk-in: agreements are pre-checked, nNumber is visible
    await fillBookingForm(page, {
      firstName: "Walk-In",
      lastName: "Visitor",
      netId: "wv456",
      checkAgreements: false, // pre-checked for walk-in
    });

    // ── 6. Submit ──
    await page.getByRole("button", { name: "Submit" }).click();

    // ── 7. Confirmation page ──
    await page.waitForURL("**/mc/walk-in/confirmation", { timeout: 15000 });

    const heading = page.getByText(/Walk-in submitted/i);
    await heading.waitFor({ state: "visible", timeout: 30000 });
    await expect(heading).toBeVisible();
  });
});
