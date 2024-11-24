const { test, expect, chromium } = require('@playwright/test');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.resolve(__dirname, '../../.env.local') });

if (!process.env.TEST_EMAIL_ADDRESS || !process.env.TEST_PASSWORD) {
  throw new Error('TEST_EMAIL_ADDRESS is not defined in environment variables');
}

test('test', async ({ page }) => {

  // Store the popup promise before navigation
  const popupPromise = page.waitForEvent('popup');

  // Navigate to the page
  await page.goto('http://localhost:3000/');

  //wait for 50 seconds for the popup to load
  await page.waitForTimeout(30000);

  // Wait for the popup with a timeout
  const page1 = await popupPromise.catch(error => {
    console.error('Failed to get popup:', error);
    throw new Error('Popup failed to open or was closed too quickly');
  });

  // Verify popup is valid
  if (!page1 || page1.isClosed()) {
    console.error('Popup state:', {
      exists: !!page1,
      isClosed: page1?.isClosed()
    });
    throw new Error('Popup was closed immediately after opening');
  }

  try {
    // Add longer timeouts for CI environment
    await page1.setDefaultTimeout(60000); // 60 seconds
    await page1.setDefaultNavigationTimeout(60000);
    await page1.bringToFront();
    // Wait for initial page load with retry logic
    let retries = 3;
    while (retries > 0) {
      try {
        await page1.waitForLoadState('domcontentloaded', { timeout: 30000 });
        await page1.waitForLoadState('networkidle', { timeout: 30000 });
        break;
      } catch (error) {
        console.error(`Retry ${4 - retries}/3 failed:`, error);
        retries--;
        if (retries === 0) throw error;
        await page1.waitForTimeout(2000); // Wait before retry
      }
    }

    // Ensure the email input is actually visible and interactive
    await page1.waitForSelector('input[type="email"], input[aria-label="Email or phone"]',
      { state: 'visible', timeout: 30000 });

    // Login sequence with explicit waits and error handling
    const emailInput = await page1.getByLabel('Email or phone');
    await emailInput.waitFor({ state: 'visible', timeout: 30000 });
    await emailInput.click({ timeout: 30000 });
    await emailInput.fill(process.env.TEST_EMAIL_ADDRESS);

    const nextButton = page1.getByRole('button', { name: 'Next' });
    await nextButton.waitFor({ state: 'visible', timeout: 30000 });
    await nextButton.click({ timeout: 30000 });

    const passwordInput = await page1.getByLabel('Enter your password');
    await passwordInput.waitFor({ state: 'visible', timeout: 30000 });
    await passwordInput.click({ timeout: 30000 });
    await passwordInput.fill(process.env.TEST_PASSWORD);

    const submitButton = page1.getByRole('button', { name: 'Next' });
    await submitButton.waitFor({ state: 'visible', timeout: 30000 });
    await submitButton.click({ timeout: 30000 });

    // Wait for login completion
    await page1.waitForNavigation({
      waitUntil: 'networkidle',
      timeout: 30000
    }).catch(error => {
      console.error('Navigation after login failed:', error);
    });

    const combobox = page.getByRole('combobox');

    // Check if the combobox exists
    if (await combobox.count() > 0) {
      // Click the combobox
      await combobox.click();

      // Select the option "Cancel"
      await page.getByRole('option', { name: 'Cancel' }).click();

      const confirmBtn = page.locator('button:has(svg[data-testid="CheckIcon"])');
      await confirmBtn.click();

      await page.getByRole('button', { name: 'Ok' }).click();
      await page.waitForTimeout(5000);
      await page.goto('http://localhost:3000/');
    }
  } catch (error) {
    console.error("An error occurred during the login sequence:", error);
    throw error; // Rethrow to fail the test
  }

  // Continue with booking process
  try {
    await page.getByRole('button', { name: 'Request a Reservation' }).waitFor({ state: 'visible' });
    await page.getByRole('button', { name: 'Request a Reservation' }).click();

    await page.getByRole('button', { name: 'I accept' }).waitFor({ state: 'visible' });
    await page.getByRole('button', { name: 'I accept' }).click();

    // Department selection
    await page.getByText('Choose a Department').waitFor({ state: 'visible' });
    await page.getByText('Choose a Department').click();
    await page.getByRole('option', { name: 'ITP / IMA / Low Res' }).waitFor({ state: 'visible' });
    await page.getByRole('option', { name: 'ITP / IMA / Low Res' }).click();

    // Role selection
    await page.getByText('Choose a Role').waitFor({ state: 'visible' });
    await page.getByText('Choose a Role').click();
    await page.getByRole('option', { name: 'Resident/Fellow' }).waitFor({ state: 'visible' });
    await page.getByRole('option', { name: 'Resident/Fellow' }).click();

    await page.getByRole('button', { name: 'Next' }).waitFor({ state: 'visible' });
    await page.getByRole('button', { name: 'Next' }).click();

    // wait for buttons to be visible
    await page.waitForSelector("button[data-timestamp]:not([disabled])");
    await page.locator('label').filter({ hasText: 'Co-Lab' }).getByLabel('controlled').check();
    const buttons = await page.$$("button[data-timestamp]:not([disabled])");
    console.log("Found buttons:", buttons.length);

    let alertAppeared = false;

    for (let button of buttons) {
      try {
        console.log("Clicking button...");
        await button.click();
        await page.waitForTimeout(1000); // Wait 1 second for UI to update after button click

        const timegridSlots = await page.$$("td.fc-timegrid-slot-lane");

        for (let td of timegridSlots) {
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
  } catch (error) {
    console.error("An error occurred during the booking sequence:", error);
    throw error;
  }
}
);