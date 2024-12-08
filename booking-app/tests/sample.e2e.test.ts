import { test, expect } from '@playwright/test';

test('Search for text Media Commons in the title', async ({ page }) => {
  await page.goto('http://localhost:3000');
  
  //make sure there is an h4 element with the text "Media Commons"

  await expect(page).toHaveTitle('Media commons booking app');
});

test('Go through the booking process', async ({ page }) => {
  await page.goto('http://localhost:3000');
});
