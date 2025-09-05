const { test, expect } = require('@playwright/test');

// Check if authentication bypass is enabled
const isAuthBypassEnabled = process.env.BYPASS_AUTH === 'true' || process.env.E2E_TESTING === 'true';

test.describe('Booking E2E Test with Authentication Bypass', () => {
  test('should complete booking flow with authentication bypass', async ({ page }) => {
    console.log('Authentication bypass enabled:', isAuthBypassEnabled);
    
    if (!isAuthBypassEnabled) {
      test.skip('Authentication bypass not enabled - skipping test');
      return;
    }
    
    try {
      console.log('Using authentication bypass - no manual login required');
      await page.goto('http://localhost:3000/');
      
      // Wait for the authentication bypass to take effect
      await page.waitForTimeout(3000);
      
      // The authentication bypass should automatically log in the user
      // Check if there are any existing bookings to cancel first
      const combobox = page.getByRole('combobox');

      // Check if the combobox exists (existing booking)
      if (await combobox.count() > 0) {
        console.log('Found existing booking to cancel');
        await combobox.click();
        await page.getByRole('option', { name: 'Cancel' }).click();
        const confirmBtn = page.locator('button:has(svg[data-testid="CheckIcon"])');
        await confirmBtn.click();
        await page.getByRole('button', { name: 'Ok' }).click();
        await page.waitForTimeout(3000);
        await page.goto('http://localhost:3000/');
      }

      // Start booking process
      await page.getByRole('button', { name: 'Request a Reservation' }).waitFor({ state: 'visible', timeout: 10000 });
      await page.getByRole('button', { name: 'Request a Reservation' }).click();

      await page.getByRole('button', { name: 'I accept' }).waitFor({ state: 'visible', timeout: 10000 });
      await page.getByRole('button', { name: 'I accept' }).click();

      // Department selection
      await page.getByText('Choose a Department').waitFor({ state: 'visible', timeout: 10000 });
      await page.getByText('Choose a Department').click();
      await page.getByRole('option', { name: 'ITP / IMA / Low Res' }).waitFor({ state: 'visible', timeout: 10000 });
      await page.getByRole('option', { name: 'ITP / IMA / Low Res' }).click();

      // Role selection  
      await page.getByText('Choose a Role').waitFor({ state: 'visible', timeout: 10000 });
      await page.getByText('Choose a Role').click();
      await page.getByRole('option', { name: 'Resident/Fellow' }).waitFor({ state: 'visible', timeout: 10000 });
      await page.getByRole('option', { name: 'Resident/Fellow' }).click();

      await page.getByRole('button', { name: 'Next' }).waitFor({ state: 'visible', timeout: 10000 });
      await page.getByRole('button', { name: 'Next' }).click();

      // Select room and time slot
      await page.waitForSelector("button[data-timestamp]:not([disabled])", { timeout: 15000 });
      await page.locator('label').filter({ hasText: 'Co-Lab' }).getByLabel('controlled').check();
      
      const buttons = await page.$$("button[data-timestamp]:not([disabled])");
      console.log("Found buttons:", buttons.length);

      let alertAppeared = false;

      // Try to book a time slot
      for (let button of buttons.slice(0, 5)) { // Try first 5 buttons to save time
        try {
          console.log("Clicking button...");
          await button.click();
          await page.waitForTimeout(1000);

          const timegridSlots = await page.$$("td.fc-timegrid-slot-lane");

          for (let td of timegridSlots.slice(0, 3)) { // Try first 3 slots to save time
            try {
              const bgHarness = await page.$("div.fc-timegrid-bg-harness");
              if (bgHarness) continue;

              console.log("Trying to click a td...");
              await td.click();
              await page.waitForTimeout(1000);

              alertAppeared = await page.$("div[role='alert']");
              if (alertAppeared) break;
            } catch {
              continue;
            }
          }

          if (alertAppeared) break;
        } catch {
          continue;
        }
      }

      if (!alertAppeared) {
        throw new Error("No alert appeared after all attempts.");
      }

      // Fill booking form
      await page.getByRole('button', { name: 'Next', exact: true }).waitFor({ state: 'visible', timeout: 10000 });
      await page.getByRole('button', { name: 'Next', exact: true }).click();

      await page.locator('input[name="firstName"]').click();
      await page.locator('input[name="firstName"]').fill('Test');

      await page.locator('input[name="lastName"]').click();
      await page.locator('input[name="lastName"]').fill('Test');

      await page.locator('input[name="nNumber"]').click();
      await page.locator('input[name="nNumber"]').fill('N11223344');

      await page.locator('input[name="netId"]').click();
      await page.locator('input[name="netId"]').fill('t111');

      await page.locator('input[name="phoneNumber"]').click();
      await page.locator('input[name="phoneNumber"]').fill('215-319-3211');

      await page.locator('input[name="title"]').click();
      await page.locator('input[name="title"]').fill('Test Event');

      await page.locator('input[name="description"]').click();
      await page.locator('input[name="description"]').fill('Test Description');

      await page.locator('#mui-component-select-bookingType').click();
      await page.getByRole('option', { name: 'Panel Discussion' }).click();

      await page.locator('input[name="expectedAttendance"]').click();
      await page.locator('input[name="expectedAttendance"]').fill('12');

      await page.getByLabel('Select an option').click();
      await page.getByRole('option', { name: 'NYU Members with an active' }).click();

      await page.locator('#checklist').check();
      await page.locator('#resetRoom').check();
      await page.locator('#bookingPolicy').check();

      // Submit booking
      await page.getByRole('button', { name: 'Submit' }).click();
      
      // Wait for success message
      await page.waitForSelector('h6', { timeout: 15000 });
      await expect(page.getByRole('heading', { name: 'Yay! We\'ve received your' })).toBeVisible();
      
      console.log('✅ Booking completed successfully with authentication bypass!');

    } catch (error) {
      console.error("An error occurred during the booking test:", error);
      throw error;
    }
  });
});