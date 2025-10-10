import { expect, test } from '@playwright/test';
import { registerBookingMocks } from './helpers/mock-routes';
import { BookingTestHelper, TestDataFactory } from './helpers/booking-test-helpers';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000';

async function completeStandardBooking(page, helper) {
  const formData = TestDataFactory.createStandardBooking();

  // Role selection
  await page.goto(`${BASE_URL}/mc/book/role`, { waitUntil: 'domcontentloaded' });
  await helper.fillBasicBookingForm(formData);

  // Room selection
  await helper.selectRoomAndTime();

  // Details form
  await helper.fillEventDetails(formData);
  await helper.acceptRequiredTerms();
  await helper.submitBooking();

  await expect(page.getByRole('heading', { name: /Yay! We've received your/i })).toBeVisible();
}

test.describe('Complete Booking Flow', () => {
  test.beforeEach(async ({ page }) => {
    await registerBookingMocks(page);
  });

  test('should complete booking request end-to-end', async ({ page }) => {
    console.log('🎯 Running complete booking flow test');
    const helper = new BookingTestHelper(page);
    await completeStandardBooking(page, helper);
    console.log('🎉 Booking flow completed');
  });
});
