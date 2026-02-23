import { expect, test } from "@playwright/test";
import { registerBookingMocks } from "./helpers/mock-routes";
import { selectDropdown, selectTimeSlot } from "./helpers/test-utils";

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

test.describe("Booking Flow – complete reservation", () => {
  test.beforeEach(async ({ page }) => {
    await registerBookingMocks(page);
  });

  test("should complete a booking from start to confirmation", async ({
    page,
  }) => {
    // ── 1. Landing page ──
    await page.goto(`${BASE_URL}/mc`, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle");

    // Auth bypass should prevent redirect to signin
    expect(page.url()).not.toContain("/signin");

    const requestBtn = page.getByRole("button", {
      name: /Request a Reservation/i,
    });
    await requestBtn.waitFor({ state: "visible", timeout: 15000 });
    await requestBtn.click();

    // ── 2. Terms page ──
    await page.waitForURL("**/mc/book", { timeout: 15000 });
    await page.waitForLoadState("networkidle");
    const acceptBtn = page.getByRole("button", { name: /^I accept$/i });
    await acceptBtn.waitFor({ state: "visible", timeout: 10000 });
    await acceptBtn.click();

    // ── 3. Role selection page ──
    await page.waitForURL("**/mc/book/role", { timeout: 15000 });
    await page.waitForLoadState("networkidle");

    // School → Department → Role
    // School options: ["Tisch School of the Arts", "Other"] → pick index 0
    await selectDropdown(page, "school-select", 0);

    // Department options: ["ITP / IMA / Low Res", "General Department", "Other"] → pick index 0
    const deptSelect = page.getByTestId("department-select");
    await deptSelect.waitFor({ state: "visible", timeout: 10000 });
    await selectDropdown(page, "department-select", 0);

    // Role options: ["Student", "Faculty", "Staff"] → pick Faculty (index 1) to skip sponsor
    const roleSelect = page.getByTestId("role-select");
    await roleSelect.waitFor({ state: "visible", timeout: 10000 });
    await selectDropdown(page, "role-select", 1);

    // Click Next
    await page.getByRole("button", { name: "Next", exact: true }).click();

    // ── 4. Room & time selection ──
    await page.waitForURL("**/mc/book/selectRoom", { timeout: 15000 });
    await selectTimeSlot(page);

    // Wait for time selection to register (Next button becomes enabled)
    await page.waitForTimeout(500);

    // Click Next (use exact: true to avoid "Next month" calendar button)
    const nextBtn = page.getByRole("button", { name: "Next", exact: true });
    await nextBtn.waitFor({ state: "visible", timeout: 10000 });
    await nextBtn.click();

    // ── 5. Form details page ──
    await page.waitForURL("**/mc/book/form", { timeout: 15000 });
    await page.waitForLoadState("networkidle");

    // Contact Information
    await page.locator('input[name="firstName"]').fill("Test");
    await page.locator('input[name="lastName"]').fill("Faculty");
    await page.locator('input[name="nNumber"]').fill("N12345678");
    await page.locator('input[name="netId"]').fill("tf123");
    await page.locator('input[name="phoneNumber"]').fill("2125551234");

    // Reservation Details
    await page.locator('input[name="title"]').fill("E2E Test Booking");
    await page.locator('input[name="description"]').fill("Automated test");

    // Booking Type – the Provider falls back to "Other" when Firestore is mocked.
    // Wait for dropdown to appear (may take a moment for settings to load).
    const bookingTypeSelect = page.getByTestId("booking-type-select");
    await bookingTypeSelect.waitFor({ state: "visible", timeout: 30000 });
    await selectDropdown(page, "booking-type-select", 0);

    // Expected Attendance
    await page.locator('input[name="expectedAttendance"]').fill("10");

    // Attendee Affiliation – "NYU Members with an active NYU ID" (index 0)
    await selectDropdown(page, "attendee-affiliation-select", 0);

    // Agreements
    await page.locator("#checklist").check();
    await page.locator("#resetRoom").check();
    await page.locator("#bookingPolicy").check();

    // ── 6. Submit ──
    await page.getByRole("button", { name: "Submit" }).click();

    // ── 7. Confirmation page ──
    await page.waitForURL("**/mc/book/confirmation", { timeout: 15000 });

    const heading = page.getByRole("heading", {
      name: /Yay! We've received your booking request/i,
    });
    await heading.waitFor({ state: "visible", timeout: 30000 });
    await expect(heading).toBeVisible();
  });
});
