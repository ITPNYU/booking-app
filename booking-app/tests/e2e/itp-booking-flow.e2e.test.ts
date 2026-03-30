import { expect, test } from "@playwright/test";
import { registerItpBookingMocks } from "./helpers/itp-mock-routes";
import {
  itpNavigateToRoleSelection,
  itpSelectRole,
  itpSelectTimeSlot,
  itpFillBookingForm,
} from "./helpers/itp-test-utils";

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

test.describe("ITP Booking Flow – complete reservation", () => {
  test.beforeEach(async ({ page }) => {
    await registerItpBookingMocks(page);
  });

  test("should complete an ITP booking from start to confirmation", async ({
    page,
  }) => {
    // ── 1. Landing page ──
    await page.goto(`${BASE_URL}/itp`, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle");

    expect(page.url()).not.toContain("/signin");

    const requestBtn = page.getByRole("button", {
      name: /Request a Reservation/i,
    });
    await requestBtn.waitFor({ state: "visible", timeout: 15000 });
    await requestBtn.click();

    // ── 2. Terms page ──
    await page.waitForURL("**/itp/book", { timeout: 15000 });
    await page.waitForLoadState("networkidle");
    const acceptBtn = page.getByRole("button", { name: /^I accept$/i });
    await acceptBtn.waitFor({ state: "visible", timeout: 10000 });
    await acceptBtn.click();

    // ── 3. Role selection page ──
    await page.waitForURL("**/itp/book/role", { timeout: 15000 });
    await page.waitForLoadState("networkidle");

    // School → Department → Role (Student)
    await itpSelectRole(page, { roleIndex: 0 });

    await page.getByRole("button", { name: "Next", exact: true }).click();

    // ── 4. Room & time selection ──
    await page.waitForURL("**/itp/book/selectRoom", { timeout: 15000 });
    await itpSelectTimeSlot(page, "408");

    await page.waitForTimeout(500);

    const nextBtn = page.getByRole("button", { name: "Next", exact: true });
    await nextBtn.waitFor({ state: "visible", timeout: 10000 });
    await nextBtn.click();

    // ── 5. Form details page ──
    await page.waitForURL("**/itp/book/form", { timeout: 15000 });
    await page.waitForLoadState("networkidle");

    await itpFillBookingForm(page, {
      firstName: "Test",
      lastName: "Student",
      netId: "ts123",
      title: "ITP Booking Flow Test",
    });

    // ── 6. Submit ──
    await page.getByRole("button", { name: "Submit" }).click();

    // ── 7. Confirmation page ──
    await page.waitForURL("**/itp/book/confirmation", { timeout: 15000 });

    const heading = page.getByRole("heading", {
      name: /Yay! We've received your booking request/i,
    });
    await heading.waitFor({ state: "visible", timeout: 30000 });
    await expect(heading).toBeVisible();
  });

  test("should complete ITP booking as Faculty", async ({ page }) => {
    await itpNavigateToRoleSelection(page);

    // Faculty = index 1
    await itpSelectRole(page, { roleIndex: 1 });
    await page.getByRole("button", { name: "Next", exact: true }).click();

    await page.waitForURL("**/itp/book/selectRoom", { timeout: 15000 });
    await itpSelectTimeSlot(page, "408");
    await page.waitForTimeout(500);
    await page.getByRole("button", { name: "Next", exact: true }).click();

    await page.waitForURL("**/itp/book/form", { timeout: 15000 });
    await page.waitForLoadState("networkidle");

    await itpFillBookingForm(page, {
      firstName: "Test",
      lastName: "Faculty",
      netId: "tf456",
      title: "ITP Faculty Booking Test",
    });

    await page.getByRole("button", { name: "Submit" }).click();

    await page.waitForURL("**/itp/book/confirmation", { timeout: 15000 });
    const heading = page.getByRole("heading", {
      name: /Yay! We've received your booking request/i,
    });
    await heading.waitFor({ state: "visible", timeout: 30000 });
    await expect(heading).toBeVisible();
  });

  test("should not show N-number field for ITP", async ({ page }) => {
    await itpNavigateToRoleSelection(page);

    await itpSelectRole(page, { roleIndex: 0 });
    await page.getByRole("button", { name: "Next", exact: true }).click();

    await page.waitForURL("**/itp/book/selectRoom", { timeout: 15000 });
    await itpSelectTimeSlot(page, "408");
    await page.waitForTimeout(500);
    await page.getByRole("button", { name: "Next", exact: true }).click();

    await page.waitForURL("**/itp/book/form", { timeout: 15000 });
    await page.waitForLoadState("networkidle");

    // N-number field should NOT be visible (showNNumber: false)
    const nNumberField = page.locator('input[name="nNumber"]');
    await expect(nNumberField).toHaveCount(0);
  });

  test("should not show sponsor fields for ITP", async ({ page }) => {
    await itpNavigateToRoleSelection(page);

    // Student role — MC would show sponsor fields for students
    await itpSelectRole(page, { roleIndex: 0 });
    await page.getByRole("button", { name: "Next", exact: true }).click();

    await page.waitForURL("**/itp/book/selectRoom", { timeout: 15000 });
    await itpSelectTimeSlot(page, "408");
    await page.waitForTimeout(500);
    await page.getByRole("button", { name: "Next", exact: true }).click();

    await page.waitForURL("**/itp/book/form", { timeout: 15000 });
    await page.waitForLoadState("networkidle");

    // Sponsor fields should NOT be visible (showSponsor: false)
    const sponsorFirst = page.locator('input[name="sponsorFirstName"]');
    const sponsorLast = page.locator('input[name="sponsorLastName"]');
    const sponsorEmail = page.locator('input[name="sponsorEmail"]');
    await expect(sponsorFirst).toHaveCount(0);
    await expect(sponsorLast).toHaveCount(0);
    await expect(sponsorEmail).toHaveCount(0);
  });

  test("should not show booking type dropdown for ITP", async ({ page }) => {
    await itpNavigateToRoleSelection(page);

    await itpSelectRole(page, { roleIndex: 1 });
    await page.getByRole("button", { name: "Next", exact: true }).click();

    await page.waitForURL("**/itp/book/selectRoom", { timeout: 15000 });
    await itpSelectTimeSlot(page, "408");
    await page.waitForTimeout(500);
    await page.getByRole("button", { name: "Next", exact: true }).click();

    await page.waitForURL("**/itp/book/form", { timeout: 15000 });
    await page.waitForLoadState("networkidle");

    // Booking type dropdown should NOT be visible (showBookingTypes: false)
    const bookingTypeSelect = page.getByTestId("booking-type-select");
    const isVisible = await bookingTypeSelect
      .isVisible({ timeout: 3000 })
      .catch(() => false);
    expect(isVisible).toBe(false);
  });
});
