import { expect, test } from '@playwright/test';
import { registerBookingMocks } from './helpers/mock-routes';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000';

async function ensureRoleSelectionPage(page) {
  await page.goto(`${BASE_URL}/mc/book/role`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle');

  if (page.url().endsWith('/mc') || page.url().endsWith('/mc/')) {
    const requestButton = page.getByRole('button', { name: /Request a Reservation/i });
    await requestButton.waitFor({ state: 'visible', timeout: 15000 });
    await requestButton.click();

    await page.waitForURL('**/mc/book', { timeout: 15000 });
    const acceptButton = page.getByRole('button', { name: /^I accept$/i });
    await acceptButton.waitFor({ state: 'visible', timeout: 15000 });
    await acceptButton.click();

    await page.waitForURL('**/mc/book/role', { timeout: 15000 });
    await page.waitForLoadState('networkidle');
  }

  const departmentLocator = page.locator('[data-testid="department-select"]').first();
  if (await departmentLocator.count()) {
    await departmentLocator.waitFor({ state: 'attached', timeout: 15000 });
  } else {
    await page
      .locator('text=Choose a Department')
      .first()
      .waitFor({ state: 'attached', timeout: 15000 });
  }
}

const DROPDOWN_TEST_IDS: Record<string, string> = {
  'Choose a Department': 'department-select',
  'Choose a Role': 'role-select',
  'Booking Type': 'booking-type-select',
  'Attendee Affiliation(s)': 'attendee-affiliation-select',
};

function labelFromTestId(testId: string): string {
  const entries = Object.entries(DROPDOWN_TEST_IDS);
  const found = entries.find(([, value]) => value === testId);
  return found ? found[0] : '';
}

const DROPDOWN_OPTION_INDEX: Record<string, Record<string, number>> = {
  'Choose a Department': {
    'ITP / IMA / Low Res': 0,
    'General Department': 1,
  },
  'Choose a Role': {
    Student: 0,
    Faculty: 1,
    Staff: 2,
  },
  'Booking Type': {
    'Class Session': 0,
    'General Event': 1,
  },
  'Attendee Affiliation(s)': {
    'NYU Members with an active NYU ID': 0,
    'Non-NYU guests': 1,
    'All of the above': 2,
  },
};

async function chooseOption(page, menuTestId: string | undefined, optionText: string) {
  if (menuTestId) {
    const menu = page.getByTestId(`${menuTestId}-menu`);
    await menu.waitFor({ state: 'visible', timeout: 15000 });

    const optionIndex = DROPDOWN_OPTION_INDEX[labelFromTestId(menuTestId)]?.[optionText];
    if (optionIndex != null) {
      await menu.getByTestId(`${menuTestId}-option-${optionIndex}`).click();
    } else {
      await menu
        .locator(`[data-testid^="${menuTestId}-option-"]`)
        .filter({ hasText: optionText })
        .first()
        .click();
    }
    await page.waitForTimeout(200);
    return;
  }

  const fallbackMenu = page.locator('li[role="option"]').filter({ hasText: optionText }).first();
  await fallbackMenu.waitFor({ state: 'visible', timeout: 15000 });
  await fallbackMenu.click();
  await page.waitForTimeout(200);
}

async function selectDropdown(page, label, optionText) {
  const testId = DROPDOWN_TEST_IDS[label] ?? undefined;

  if (testId) {
    await page.getByTestId(testId).click();
    await chooseOption(page, testId, optionText);
    return;
  }

  await page.getByText(label, { exact: false }).first().click();
  await chooseOption(page, undefined, optionText);
}

async function selectRoomAndTime(page) {
  const ROOM_ID = '202';
  await page.getByTestId(`room-option-${ROOM_ID}`).check();

  const calendar = page.locator('[data-testid="booking-calendar-wrapper"]');
  await calendar.waitFor({ state: 'visible', timeout: 15000 });

  // Pick a slot that starts one hour from "now" to keep the selection in the future.
  const now = new Date();
  now.setMinutes(0, 0, 0);
  now.setHours(now.getHours() + 1);

  const EARLIEST_HOUR = 9;
  const LATEST_START_HOUR = 21; // allows a one-hour block before closing
  let startHour = now.getHours();
  if (startHour < EARLIEST_HOUR) startHour = EARLIEST_HOUR;
  if (startHour > LATEST_START_HOUR) startHour = LATEST_START_HOUR;

  const endHour = startHour + 1;
  const formatHour = (hour: number) => `${hour.toString().padStart(2, '0')}:00:00`;
  const findSlot = async (hour: number) => {
    const candidates = [
      `[data-resource-id="${ROOM_ID}"][data-time="${formatHour(hour)}"]`,
      `.fc-timegrid-slot.fc-timegrid-slot-lane[data-resource-id="${ROOM_ID}"][data-time="${formatHour(hour)}"]`,
      `.fc-timegrid-slot.fc-timegrid-slot-lane[data-time="${formatHour(hour)}"]`,
      `.fc-timegrid-slot.fc-timegrid-slot-lane[aria-label*="${hour % 12 === 0 ? 12 : hour % 12}"]`,
      `[data-time="${formatHour(hour)}"]`,
    ];

    for (const selector of candidates) {
      const slot = calendar.locator(selector).first();
      if ((await slot.count()) > 0) {
        return slot;
      }
    }
    return null;
  };

  const startSlot = await findSlot(startHour);
  const endSlot = await findSlot(endHour);

  if (!startSlot || !endSlot) {
    throw new Error(`Could not find time slots for range ${startHour}:00-${endHour}:00`);
  }

  await startSlot.scrollIntoViewIfNeeded();
  await endSlot.scrollIntoViewIfNeeded();

  const startBox = await startSlot.boundingBox();
  const endBox = await endSlot.boundingBox();

  if (!startBox || !endBox) {
    throw new Error('Unable to determine calendar slot positions');
  }

  const mouseX = startBox.x + startBox.width / 2;
  const startY = startBox.y + startBox.height / 2;
  const endY = endBox.y + endBox.height / 2;

  await page.mouse.move(mouseX, startY);
  await page.mouse.down();
  await page.mouse.move(mouseX, endY, { steps: 8 });
  await page.mouse.up();
}

async function fillDetails(page) {
  await page.locator('input[name="firstName"]').fill('Peter');
  await page.locator('input[name="lastName"]').fill('Parker');
  await page.locator('input[name="nNumber"]').fill('N12345678');
  await page.locator('input[name="netId"]').fill('pp1234');
  await page.locator('input[name="phoneNumber"]').fill('2125551234');

  await page.locator('input[name="sponsorFirstName"]').fill('Noah');
  await page.locator('input[name="sponsorLastName"]').fill('Pivnick');
  await page.locator('input[name="sponsorEmail"]').fill('noah.pivnick@nyu.edu');

  await page.locator('input[name="title"]').fill('Automatic approval test');
  await page.locator('input[name="description"]').fill('Automatic approval end-to-end test');

  await selectDropdown(page, 'Booking Type', 'General Event');
  await page.locator('input[name="expectedAttendance"]').fill('4');
  await selectDropdown(
    page,
    'Attendee Affiliation(s)',
    'NYU Members with an active NYU ID'
  );

  await page.locator('#checklist').check();
  await page.locator('#resetRoom').check();
  await page.locator('#bookingPolicy').check();
}

test.describe('Automatic Approval Booking Flow', () => {
  test.beforeEach(async ({ page }) => {
    await registerBookingMocks(page);
  });

  test('should submit booking that qualifies for automatic approval', async ({ page }) => {
    await ensureRoleSelectionPage(page);

    await selectDropdown(page, 'Choose a Department', 'ITP / IMA / Low Res');
    await selectDropdown(page, 'Choose a Role', 'Student');

    await page.getByRole('button', { name: 'Next', exact: true }).click();
    await page.waitForURL('**/mc/book/selectRoom');

    await selectRoomAndTime(page);

    await page.getByRole('button', { name: 'Next', exact: true }).click();
    await page.waitForURL('**/mc/book/form');

    await fillDetails(page);

    await page.getByRole('button', { name: 'Submit' }).click();

    await expect(page.getByRole('heading', { name: /Yay! We've received your/i })).toBeVisible();
  });
});
