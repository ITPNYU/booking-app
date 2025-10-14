import { expect, test } from "@playwright/test";
import { BookingTestHelper } from "./helpers/booking-test-helpers";
import { registerBookingMocks } from "./helpers/mock-routes";

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

const DROPDOWN_TEST_IDS: Record<string, string> = {
  "Choose a Department": "department-select",
  "Choose a Role": "role-select",
  "Booking Type": "booking-type-select",
  "Attendee Affiliation(s)": "attendee-affiliation-select",
};

const DROPDOWN_OPTION_INDEX: Record<string, Record<string, number>> = {
  "Choose a Department": {
    "ITP / IMA / Low Res": 0,
    "General Department": 1,
  },
  "Choose a Role": {
    Student: 0,
    Faculty: 1,
    Staff: 2,
  },
  "Booking Type": {
    "Class Session": 0,
    "General Event": 1,
  },
  "Attendee Affiliation(s)": {
    "NYU Members with an active NYU ID": 0,
    "Non-NYU guests": 1,
    "All of the above": 2,
  },
};

function labelFromTestId(testId: string): string {
  const entries = Object.entries(DROPDOWN_TEST_IDS);
  const found = entries.find(([, value]) => value === testId);
  return found ? found[0] : "";
}

async function ensureRoleSelectionPage(page) {
  const helper = new BookingTestHelper(page);
  await helper.navigateToRoleSelection(BASE_URL);
}

async function chooseOption(
  page,
  menuTestId: string | undefined,
  optionText: string
) {
  if (menuTestId) {
    const menu = page.getByTestId(`${menuTestId}-menu`);
    await menu.waitFor({ state: "visible", timeout: 15000 });

    const optionIndex =
      DROPDOWN_OPTION_INDEX[labelFromTestId(menuTestId)]?.[optionText];
    if (optionIndex != null) {
      await menu.getByTestId(`${menuTestId}-option-${optionIndex}`).click();
    } else {
      await menu
        .locator(`[data-testid^="${menuTestId}-option-"]`)
        .filter({ hasText: optionText })
        .first()
        .click();
    }

    return;
  }

  await page.getByText(optionText, { exact: false }).first().click();
}

async function selectDropdown(page, label: string, optionText: string) {
  const testId = DROPDOWN_TEST_IDS[label];

  if (testId) {
    // Wait for dropdown to be visible and interactable
    const dropdown = page.getByTestId(testId);
    await dropdown.waitFor({ state: "visible", timeout: 30000 });
    await dropdown.click();

    await chooseOption(page, testId, optionText);
    return;
  }

  // Fallback to text-based selector with increased timeout
  const trigger = page.getByText(label, { exact: false }).first();
  await trigger.waitFor({ state: "visible", timeout: 30000 });
  await trigger.click();
  await chooseOption(page, undefined, optionText);
}

function formatTime(date: Date): string {
  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");
  return `${hours}:${minutes}`;
}

function computeTimeRange({
  startOffsetMinutes = 60,
  durationMinutes = 60,
  intervalMinutes = 30,
  closingHour = 21,
  fallbackStart = "10:00",
}: {
  startOffsetMinutes?: number;
  durationMinutes?: number;
  intervalMinutes?: number;
  closingHour?: number;
  fallbackStart?: string;
} = {}) {
  const now = new Date();
  now.setSeconds(0, 0);

  const start = new Date(now.getTime() + startOffsetMinutes * 60 * 1000);
  start.setSeconds(0, 0);

  const remainder = start.getMinutes() % intervalMinutes;
  if (remainder !== 0) {
    start.setMinutes(start.getMinutes() + (intervalMinutes - remainder));
  }

  if (start.getHours() >= closingHour) {
    const [fallbackHour, fallbackMinute] = fallbackStart.split(":").map(Number);
    start.setHours(fallbackHour, fallbackMinute ?? 0, 0, 0);
  }

  const end = new Date(start.getTime() + durationMinutes * 60 * 1000);

  return {
    startTime: formatTime(start),
    endTime: formatTime(end),
  };
}

async function selectRoomAndTime(page) {
  await page.getByTestId("room-option-202").check();

  const { startTime, endTime } = computeTimeRange();

  const startSelect = page.locator("[data-testid=start-time]");
  const endSelect = page.locator("[data-testid=end-time]");

  await startSelect.waitFor({ state: "visible", timeout: 15000 });
  await startSelect.selectOption(startTime);

  await endSelect.waitFor({ state: "visible", timeout: 15000 });
  await endSelect.selectOption(endTime);
}

async function fillDetails(page) {
  await page.locator('input[name="firstName"]').fill("Casey");
  await page.locator('input[name="lastName"]').fill("Setup");
  await page.locator('input[name="nNumber"]').fill("N98765432");
  await page.locator('input[name="netId"]').fill("cs7654");
  await page.locator('input[name="phoneNumber"]').fill("2125559876");

  await page.locator('input[name="sponsorFirstName"]').fill("Alex");
  await page.locator('input[name="sponsorLastName"]').fill("Support");
  await page.locator('input[name="sponsorEmail"]').fill("alex.support@nyu.edu");

  await page.locator('input[name="title"]').fill("Setup required booking test");
  await page
    .locator('input[name="description"]')
    .fill("Verifying setup time handling");

  await selectDropdown(page, "Booking Type", "General Event");
  await page.locator('input[name="expectedAttendance"]').fill("6");
  await selectDropdown(
    page,
    "Attendee Affiliation(s)",
    "NYU Members with an active NYU ID"
  );

  await page.locator("#services-setup").check();

  await page.locator("#checklist").check();
  await page.locator("#resetRoom").check();
  await page.locator("#bookingPolicy").check();
}

test.describe("Setup Required Booking Flow", () => {
  test.beforeEach(async ({ page }) => {
    await registerBookingMocks(page);
  });

  test("should submit booking requiring setup time", async ({ page }) => {
    await ensureRoleSelectionPage(page);

    await selectDropdown(page, "Choose a Department", "ITP / IMA / Low Res");
    await selectDropdown(page, "Choose a Role", "Student");

    await page.getByRole("button", { name: "Next", exact: true }).click();
    await page.waitForURL("**/mc/book/selectRoom");

    await selectRoomAndTime(page);

    await page.getByRole("button", { name: "Next", exact: true }).click();
    await page.waitForURL("**/mc/book/form");

    await fillDetails(page);

    await page.getByRole("button", { name: "Submit" }).click();

    await expect(
      page.getByRole("heading", { name: /Yay! We've received your/i })
    ).toBeVisible();
  });
});
