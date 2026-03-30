import { Page } from "@playwright/test";
import { selectDropdown, selectTimeSlot } from "./test-utils";

/**
 * Navigate through the ITP booking flow up to the role selection page.
 * Landing → Terms → Role selection
 */
export async function itpNavigateToRoleSelection(
  page: Page,
  baseUrl: string = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
) {
  await page.goto(`${baseUrl}/itp`, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle");

  const requestBtn = page.getByRole("button", {
    name: /Request a Reservation/i,
  });
  await requestBtn.waitFor({ state: "visible", timeout: 15000 });
  await requestBtn.click();

  await page.waitForURL("**/itp/book", { timeout: 15000 });
  await page.waitForLoadState("networkidle");
  const acceptBtn = page.getByRole("button", { name: /^I accept$/i });
  await acceptBtn.waitFor({ state: "visible", timeout: 10000 });
  await acceptBtn.click();

  await page.waitForURL("**/itp/book/role", { timeout: 15000 });
  await page.waitForLoadState("networkidle");
}

/**
 * Select school, department, and role on the ITP UserRolePage.
 * ITP roles: Student (0), Faculty (1), Admin (2)
 */
export async function itpSelectRole(
  page: Page,
  options: {
    schoolIndex?: number;
    departmentIndex?: number;
    roleIndex?: number;
  } = {},
) {
  const { schoolIndex = 0, departmentIndex = 0, roleIndex = 0 } = options;

  await selectDropdown(page, "school-select", schoolIndex);

  const deptSelect = page.getByTestId("department-select");
  await deptSelect.waitFor({ state: "visible", timeout: 10000 });
  await selectDropdown(page, "department-select", departmentIndex);

  const roleSelect = page.getByTestId("role-select");
  await roleSelect.waitFor({ state: "visible", timeout: 10000 });
  await selectDropdown(page, "role-select", roleIndex);
}

/**
 * Select a time slot on the ITP calendar.
 * ITP rooms: 408 (default), 410
 */
export async function itpSelectTimeSlot(
  page: Page,
  roomId: string = "408",
) {
  await selectTimeSlot(page, roomId);
}

/**
 * Fill the ITP booking form.
 * ITP does NOT have: N-number, booking type, sponsor fields.
 */
export async function itpFillBookingForm(
  page: Page,
  options: {
    firstName?: string;
    lastName?: string;
    netId?: string;
    phoneNumber?: string;
    title?: string;
    description?: string;
    expectedAttendance?: string;
    checkAgreements?: boolean;
  } = {},
) {
  const {
    firstName = "Test",
    lastName = "Student",
    netId = "ts123",
    phoneNumber = "2125551234",
    title = "ITP E2E Test Booking",
    description = "Automated ITP test",
    expectedAttendance = "5",
    checkAgreements = true,
  } = options;

  await page.locator('input[name="firstName"]').fill(firstName);
  await page.locator('input[name="lastName"]').fill(lastName);

  // netId and phoneNumber may not be rendered for ITP depending on schema
  const netIdField = page.locator('input[name="netId"]');
  if (await netIdField.isVisible({ timeout: 2000 }).catch(() => false)) {
    await netIdField.fill(netId);
  }
  const phoneField = page.locator('input[name="phoneNumber"]');
  if (await phoneField.isVisible({ timeout: 2000 }).catch(() => false)) {
    await phoneField.fill(phoneNumber);
  }

  await page.locator('input[name="title"]').fill(title);
  await page.locator('input[name="description"]').fill(description);

  // ITP has no booking type dropdown (showBookingTypes: false)
  // But the form may still render a fallback — only fill if visible
  const bookingTypeSelect = page.getByTestId("booking-type-select");
  if (
    await bookingTypeSelect.isVisible({ timeout: 2000 }).catch(() => false)
  ) {
    await selectDropdown(page, "booking-type-select", 0);
  }

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

/**
 * Complete the full ITP booking flow from landing to form submission.
 * Clicks Submit but does NOT wait for the confirmation page — the caller
 * should assert the confirmation URL / heading as needed.
 */
export async function itpCompleteBookingFlow(
  page: Page,
  options: {
    roomId?: string;
    roleIndex?: number;
    formData?: Parameters<typeof itpFillBookingForm>[1];
  } = {},
) {
  const { roomId = "408", roleIndex = 0, formData = {} } = options;

  // 1. Navigate to role selection
  await itpNavigateToRoleSelection(page);

  // 2. Select role
  await itpSelectRole(page, { roleIndex });
  await page.getByRole("button", { name: "Next", exact: true }).click();

  // 3. Room & time selection
  await page.waitForURL("**/itp/book/selectRoom", { timeout: 15000 });
  await itpSelectTimeSlot(page, roomId);
  await page.waitForTimeout(500);
  const nextBtn = page.getByRole("button", { name: "Next", exact: true });
  await nextBtn.waitFor({ state: "visible", timeout: 10000 });
  await nextBtn.click();

  // 4. Fill form
  await page.waitForURL("**/itp/book/form", { timeout: 15000 });
  await page.waitForLoadState("networkidle");
  await itpFillBookingForm(page, formData);

  // 5. Submit
  await page.getByRole("button", { name: "Submit" }).click();
}
