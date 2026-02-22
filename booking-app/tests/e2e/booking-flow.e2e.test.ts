import { expect, test } from "@playwright/test";
import { registerBookingMocks } from "./helpers/mock-routes";

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

/**
 * Helper: click a custom Dropdown (MUI Select) by data-testid and pick an option.
 *
 * The Dropdown component renders:
 *   <Select data-testid="{id}">
 *     <MenuItem data-testid="{id}-option-{index}"> ... </MenuItem>
 *   </Select>
 *   <Paper data-testid="{id}-menu"> (the popup menu)
 */
async function selectDropdown(
  page: import("@playwright/test").Page,
  testId: string,
  optionIndex: number,
) {
  const dropdown = page.getByTestId(testId);
  await dropdown.waitFor({ state: "visible", timeout: 15000 });
  await dropdown.click();

  const menu = page.getByTestId(`${testId}-menu`);
  await menu.waitFor({ state: "visible", timeout: 5000 });

  const option = page.getByTestId(`${testId}-option-${optionIndex}`);
  await option.waitFor({ state: "visible", timeout: 5000 });
  await option.click();

  // Wait for menu to close
  await page.waitForTimeout(300);
}

/**
 * Helper: select a time slot on the calendar.
 *
 * FullCalendar's mouse-drag selection is unreliable in Playwright because
 * overlay elements (fc-timegrid-bg-harness, fc-timegrid-slot-lane) intercept
 * pointer events. Instead, we access the FullCalendar API via React's fiber
 * tree and call `select()` programmatically on a future date.
 */
async function selectTimeSlot(page: import("@playwright/test").Page) {
  const ROOM_ID = "202";

  // Ensure room checkbox is checked
  const roomCheckbox = page.getByTestId(`room-option-${ROOM_ID}`);
  await roomCheckbox.waitFor({ state: "visible", timeout: 15000 });
  await roomCheckbox.check();

  // Navigate to tomorrow so there are no past-time blocks
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowDay = tomorrow.getDate().toString();

  const calendarGrid = page.locator('div[role="grid"]');
  await calendarGrid.waitFor({ state: "visible", timeout: 10000 });
  await calendarGrid
    .getByRole("gridcell", { name: tomorrowDay, exact: true })
    .click();

  const calendar = page.locator('[data-testid="booking-calendar-wrapper"]');
  await calendar.waitFor({ state: "visible", timeout: 15000 });

  // Wait for FullCalendar to render with the new date
  await page.waitForTimeout(1500);

  // Use FullCalendar's API via React fiber to programmatically select a time
  await page.evaluate(() => {
    const fcEl = document.querySelector(".fc") as any;
    if (!fcEl) throw new Error("No FullCalendar element found");

    const fiberKey = Object.keys(fcEl).find(
      (k) =>
        k.startsWith("__reactFiber$") ||
        k.startsWith("__reactInternalInstance$"),
    );
    if (!fiberKey) throw new Error("No React fiber found");

    let fiber = fcEl[fiberKey];
    let attempts = 0;

    while (fiber && attempts < 50) {
      attempts++;
      if (
        fiber.stateNode &&
        fiber.stateNode !== fcEl &&
        typeof fiber.stateNode.getApi === "function"
      ) {
        const api = fiber.stateNode.getApi();
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);

        const start = new Date(tomorrow);
        start.setHours(10, 0, 0, 0);
        const end = new Date(tomorrow);
        end.setHours(11, 0, 0, 0);

        api.select(start, end, { resourceId: "202" });
        return;
      }
      fiber = fiber.return;
    }

    throw new Error("Could not find FullCalendar API");
  });

  // Wait for React state to update
  await page.waitForTimeout(500);
}

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
    await page.getByRole("button", { name: "Next" }).click();

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
