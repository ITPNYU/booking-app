import { Page } from "@playwright/test";

/**
 * Click a custom Dropdown (MUI Select) by data-testid and pick an option.
 */
export async function selectDropdown(
  page: Page,
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

  await page.waitForTimeout(300);
}

/**
 * Select a time slot on the FullCalendar via React fiber API.
 *
 * @param skipDatePicker - When true (walk-in/VIP direct), skip the CalendarDatePicker
 *   and select a future time slot on the currently displayed date.
 */
export async function selectTimeSlot(
  page: Page,
  roomId: string = "202",
  options: { skipDatePicker?: boolean } = {},
) {
  const { skipDatePicker = false } = options;

  const roomCheckbox = page.getByTestId(`room-option-${roomId}`);
  await roomCheckbox.waitFor({ state: "visible", timeout: 15000 });
  await roomCheckbox.check();

  if (!skipDatePicker) {
    // Navigate to tomorrow via the CalendarDatePicker
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowDay = tomorrow.getDate().toString();

    const calendarGrid = page.locator('div[role="grid"]');
    await calendarGrid.waitFor({ state: "visible", timeout: 10000 });
    await calendarGrid
      .getByRole("gridcell", { name: tomorrowDay, exact: true })
      .click();
  }

  const calendar = page.locator('[data-testid="booking-calendar-wrapper"]');
  await calendar.waitFor({ state: "visible", timeout: 15000 });
  await page.waitForTimeout(1500);

  // Use FullCalendar API via React fiber to programmatically select a time.
  // Always use tomorrow 10-11am to avoid timezone/past-time issues in CI (UTC).
  await page.evaluate((rid) => {
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

        api.select(start, end, { resourceId: rid });
        return;
      }
      fiber = fiber.return;
    }

    throw new Error("Could not find FullCalendar API");
  }, roomId);

  await page.waitForTimeout(500);
}

/**
 * Select school, department, and role on the UserRolePage.
 */
export async function selectRole(
  page: Page,
  options: {
    schoolIndex?: number;
    departmentIndex?: number;
    roleIndex?: number;
  } = {},
) {
  const { schoolIndex = 0, departmentIndex = 0, roleIndex = 1 } = options;

  await selectDropdown(page, "school-select", schoolIndex);

  const deptSelect = page.getByTestId("department-select");
  await deptSelect.waitFor({ state: "visible", timeout: 10000 });
  await selectDropdown(page, "department-select", departmentIndex);

  const roleSelect = page.getByTestId("role-select");
  await roleSelect.waitFor({ state: "visible", timeout: 10000 });
  await selectDropdown(page, "role-select", roleIndex);
}

/**
 * Fill in the booking form details.
 */
export async function fillBookingForm(
  page: Page,
  options: {
    firstName?: string;
    lastName?: string;
    nNumber?: string;
    netId?: string;
    phoneNumber?: string;
    title?: string;
    description?: string;
    expectedAttendance?: string;
    checkAgreements?: boolean;
    skipNNumber?: boolean;
  } = {},
) {
  const {
    firstName = "Test",
    lastName = "User",
    nNumber = "N12345678",
    netId = "tu123",
    phoneNumber = "2125551234",
    title = "E2E Test Booking",
    description = "Automated test",
    expectedAttendance = "10",
    checkAgreements = true,
    skipNNumber = false,
  } = options;

  await page.locator('input[name="firstName"]').fill(firstName);
  await page.locator('input[name="lastName"]').fill(lastName);

  if (!skipNNumber) {
    const nNumberField = page.locator('input[name="nNumber"]');
    if (await nNumberField.isVisible({ timeout: 2000 }).catch(() => false)) {
      await nNumberField.fill(nNumber);
    }
  }

  await page.locator('input[name="netId"]').fill(netId);
  await page.locator('input[name="phoneNumber"]').fill(phoneNumber);

  await page.locator('input[name="title"]').fill(title);
  await page.locator('input[name="description"]').fill(description);

  const bookingTypeSelect = page.getByTestId("booking-type-select");
  await bookingTypeSelect.waitFor({ state: "visible", timeout: 30000 });
  await selectDropdown(page, "booking-type-select", 0);

  await page
    .locator('input[name="expectedAttendance"]')
    .fill(expectedAttendance);
  await selectDropdown(page, "attendee-affiliation-select", 0);

  if (checkAgreements) {
    const checklist = page.locator("#checklist");
    if (await checklist.isVisible({ timeout: 2000 }).catch(() => false)) {
      if (!(await checklist.isChecked())) await checklist.check();
    }
    const resetRoom = page.locator("#resetRoom");
    if (await resetRoom.isVisible({ timeout: 2000 }).catch(() => false)) {
      if (!(await resetRoom.isChecked())) await resetRoom.check();
    }
    const bookingPolicy = page.locator("#bookingPolicy");
    if (await bookingPolicy.isVisible({ timeout: 2000 }).catch(() => false)) {
      if (!(await bookingPolicy.isChecked())) await bookingPolicy.check();
    }
  }
}
