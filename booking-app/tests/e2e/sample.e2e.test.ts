import { test, expect } from '@playwright/test';

test('search for text Media Commons', async ({ page }) => {
  await page.goto('http://localhost:3000');
  
  //make sure there is an h4 element with the text "Media Commons"

  await expect(page).toHaveTitle('Media commons booking app');
});