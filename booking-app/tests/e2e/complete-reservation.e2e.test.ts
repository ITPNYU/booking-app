import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { registerBookingMocks } from './helpers/mock-routes';
import { BookingTestHelper, TestDataFactory, BookingOptions } from './helpers/booking-test-helpers';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000';

async function completeBookingFlow(
  page: Page,
  helper: BookingTestHelper,
  rolePath: string,
  formData,
  options: BookingOptions = {},
) {
  await page.goto(`${BASE_URL}/mc/${rolePath}`, { waitUntil: 'domcontentloaded' });
  await helper.fillBasicBookingForm(formData);
  await page.getByRole('button', { name: 'Next' }).click();

  await helper.selectRoomAndTime();
  await page.getByRole('button', { name: 'Next' }).click();

  await helper.fillEventDetails(formData);

  if (options.servicesRequested) {
    await helper.selectServices(options.servicesRequested);
  }

  await helper.acceptRequiredTerms();
  await helper.submitBooking();

  await expect(page.getByRole('heading', { name: /Yay! We've received your/i })).toBeVisible();
}

test.describe('Complete Reservation Scenarios', () => {
  test.beforeEach(async ({ page }) => {
    await registerBookingMocks(page);
  });

  test('completes standard reservation', async ({ page }) => {
    const helper = new BookingTestHelper(page);
    const formData = TestDataFactory.createStandardBooking();
    await completeBookingFlow(page, helper, 'book/role', formData);
  });

  test('completes VIP reservation', async ({ page }) => {
    const helper = new BookingTestHelper(page);
    const formData = TestDataFactory.createVipBooking();
    const options: BookingOptions = {
      isVip: true,
      servicesRequested: TestDataFactory.createServicesRequested({
        staff: true,
        catering: true,
      }),
    };
    await completeBookingFlow(page, helper, 'vip/role', formData, options);
  });

  test('completes walk-in reservation', async ({ page }) => {
    const helper = new BookingTestHelper(page);
    const formData = TestDataFactory.createWalkInBooking();
    const options: BookingOptions = {
      isWalkIn: true,
    };
    await completeBookingFlow(page, helper, 'walk-in/role', formData, options);
  });
});
