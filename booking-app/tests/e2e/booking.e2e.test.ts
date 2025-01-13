const { test, expect, chromium } = require('@playwright/test');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.resolve(__dirname, '../../.env.local') });

if (!process.env.TEST_EMAIL_ADDRESS || !process.env.TEST_PASSWORD) {
  throw new Error('TEST_EMAIL_ADDRESS is not defined in environment variables');
}

test('test', async ({ page }) => {
  try {
    let authUrl = null;

    // Set up listener before navigation
    page.on('popup', async popup => {
      try {
        // Get URL before popup closes
        authUrl = await popup.url();
        console.log('Captured auth URL:', authUrl);
      } catch (error) {
        console.error('Failed to capture URL:', error);
      }
    });

    // First visit localhost:3000
    await page.goto('http://localhost:3000/');

    // Wait a bit to ensure we get the URL
    await page.waitForTimeout(2000);

    if (!authUrl) {
      throw new Error('Failed to capture authentication URL');
    }

    // Now that we have the auth URL, navigate to it in main page
    console.log('Navigating to captured auth URL');
    await page.goto(authUrl);

    // Handle login in main page
    await page.getByLabel('Email or phone').waitFor({ state: 'visible' });
    await page.getByLabel('Email or phone').click();
    await page.getByLabel('Email or phone').fill(process.env.TEST_EMAIL_ADDRESS);

    await page.getByRole('button', { name: 'Next' }).waitFor({ state: 'visible' });
    await page.getByRole('button', { name: 'Next' }).click();

    await page.getByLabel('Enter your password').waitFor({ state: 'visible' });
    await page.getByLabel('Enter your password').fill(process.env.TEST_PASSWORD);

    await page.getByRole('button', { name: 'Next' }).waitFor({ state: 'visible' });
    await page.getByRole('button', { name: 'Next' }).click();

    // Wait for auth to complete
    await page.waitForTimeout(5000);

    // Return to the original application
    console.log('Returning to main application');
    await page.goto('http://localhost:3000/');

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
  await page.getByRole('button', { name: 'Next', exact: true }).waitFor({ state: 'visible' });
  await page.getByRole('button', { name: 'Next', exact: true }).click();

  await page.locator('input[name="firstName"]').click();
  await page.waitForTimeout(500);
  await page.locator('input[name="firstName"]').fill('Test');
  await page.waitForTimeout(500);

  await page.locator('input[name="lastName"]').click();
  await page.waitForTimeout(500);
  await page.locator('input[name="lastName"]').fill('Test');
  await page.waitForTimeout(500);

  await page.locator('input[name="secondaryName"]').click();
  await page.waitForTimeout(500);

  await page.locator('input[name="nNumber"]').click();
  await page.waitForTimeout(500);
  await page.locator('input[name="nNumber"]').fill('N11223344');
  await page.waitForTimeout(500);

  await page.locator('input[name="netId"]').click();
  await page.waitForTimeout(500);
  await page.locator('input[name="netId"]').fill('t111');
  await page.waitForTimeout(500);

  await page.locator('input[name="phoneNumber"]').click();
  await page.waitForTimeout(500);
  await page.locator('input[name="phoneNumber"]').fill('215-319-3211');
  await page.waitForTimeout(500);

  await page.locator('input[name="title"]').click();
  await page.waitForTimeout(500);
  await page.locator('input[name="title"]').fill('Test');
  await page.waitForTimeout(500);

  await page.locator('input[name="description"]').click();
  await page.waitForTimeout(500);
  await page.locator('input[name="description"]').fill('Test');
  await page.waitForTimeout(500);

  await page.locator('#mui-component-select-bookingType').click();
  await page.waitForTimeout(500);
  await page.getByRole('option', { name: 'Panel Discussion' }).click();
  await page.waitForTimeout(500);

  await page.locator('input[name="expectedAttendance"]').click();
  await page.waitForTimeout(500);
  await page.locator('input[name="expectedAttendance"]').fill('12');
  await page.waitForTimeout(500);

  await page.getByLabel('Select an option').click();
  await page.waitForTimeout(500);
  await page.getByRole('option', { name: 'NYU Members with an active' }).click();
  await page.waitForTimeout(500);

  await page.locator('#checklist').check();
  await page.waitForTimeout(500);
  await page.locator('#resetRoom').check();
  await page.waitForTimeout(500);
  await page.locator('#bookingPolicy').check();
  await page.waitForTimeout(500);

  await page.getByRole('button', { name: 'Submit' }).click();
  // wait for h6 with the text Yay! We've received your booking reques appears
  await page.waitForSelector('h6');
  await expect(page.getByRole('heading', { name: 'Yay! We\'ve received your' })).toBeVisible();
}

);