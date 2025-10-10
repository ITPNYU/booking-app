/**
 * Simple Reservation Process E2E Test
 * Tests a simplified reservation flow to verify basic functionality
 */

import { test, expect } from '@playwright/test';

test.describe('Simple Reservation Process', () => {
  test('should navigate to media-commons and start reservation process', async ({ page }) => {
    console.log('🎯 Starting simple reservation test...');

    try {
      // Navigate to media-commons tenant
      await page.goto('http://localhost:3000/media-commons');
      await page.waitForLoadState('networkidle');
      console.log('✅ Navigated to media-commons');

      // Verify we're not redirected to signin (auth bypass working)
      const currentUrl = page.url();
      expect(currentUrl).not.toContain('/signin');
      console.log('✅ Authentication bypass confirmed');

      // Look for "Request a Reservation" button
      const reservationButton = page.getByRole('button', { name: 'Request a Reservation' });
      await expect(reservationButton).toBeVisible({ timeout: 10000 });
      console.log('✅ Found reservation button');

      // Click the reservation button
      await reservationButton.click();
      console.log('✅ Clicked reservation button');

      // Wait for terms acceptance page
      const acceptButton = page.getByRole('button', { name: 'I accept' });
      await expect(acceptButton).toBeVisible({ timeout: 10000 });
      console.log('✅ Terms page loaded');

      // Accept terms
      await acceptButton.click();
      console.log('✅ Accepted terms');

      // Wait for booking form to load
      await page.waitForSelector('form', { timeout: 10000 });
      console.log('✅ Booking form loaded');

      // Verify we can see department selection
      const departmentSelector = page.getByText('Choose a Department');
      await expect(departmentSelector).toBeVisible({ timeout: 5000 });
      console.log('✅ Department selector visible');

      console.log('🎉 Simple reservation test passed!');
    } catch (error) {
      console.error('❌ Test failed:', error);
      await page.screenshot({ path: 'simple-test-failure.png', fullPage: true });
      throw error;
    }
  });

  test('should fill basic form fields', async ({ page }) => {
    console.log('🎯 Starting form filling test...');

    try {
      // Navigate and start booking process
      await page.goto('http://localhost:3000/media-commons');
      await page.waitForLoadState('networkidle');
      
      await page.getByRole('button', { name: 'Request a Reservation' }).click();
      await page.getByRole('button', { name: 'I accept' }).click();
      await page.waitForSelector('form', { timeout: 10000 });

      // Fill department
      await page.getByText('Choose a Department').click();
      await page.getByRole('option', { name: 'ITP / IMA / Low Res' }).click();
      console.log('✅ Selected department');

      // Fill role
      await page.getByText('Choose a Role').click();
      await page.getByRole('option', { name: 'Student' }).click();
      console.log('✅ Selected role');

      // Fill title
      const titleInput = page.locator('input[name="title"]');
      await titleInput.fill('Test Reservation');
      console.log('✅ Filled title');

      // Fill description
      const descriptionInput = page.locator('textarea[name="description"]');
      await descriptionInput.fill('This is a test reservation');
      console.log('✅ Filled description');

      console.log('🎉 Form filling test passed!');
    } catch (error) {
      console.error('❌ Form filling test failed:', error);
      await page.screenshot({ path: 'form-filling-failure.png', fullPage: true });
      throw error;
    }
  });
});