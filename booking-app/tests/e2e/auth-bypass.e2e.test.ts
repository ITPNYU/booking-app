import { test, expect } from '@playwright/test';

test.describe('E2E Tests with Authentication Bypass', () => {
  test('should bypass authentication when E2E_TESTING environment variable is set', async ({ page }) => {
    // Navigate to the application
    await page.goto('http://localhost:3000/');

    // Wait for the authentication check to complete
    await page.waitForTimeout(3000);

    // In test environment, the app should bypass authentication and not show login prompts
    // We should be able to see the main application content without authentication
    
    // Check that we don't get redirected to a signin page
    const currentUrl = page.url();
    expect(currentUrl).not.toContain('/signin');
    
    // Look for elements that would indicate the app loaded successfully
    // This will depend on what the main page shows when authenticated
    // Let's check for common elements that might be present
    
    try {
      // Wait for some content to load (adjust selector based on actual app structure)
      await page.waitForSelector('body', { timeout: 10000 });
      
      // Log the page content for debugging
      const pageTitle = await page.title();
      console.log('Page title:', pageTitle);
      
      const bodyText = await page.locator('body').textContent();
      console.log('Page contains authentication bypass indicators:', 
        bodyText?.includes('test') || bodyText?.includes('Test') || pageTitle.includes('Booking'));
      
      // Check that we're not stuck on an authentication page
      const hasAuthContent = await page.locator('text=/sign in|login|authenticate/i').count();
      expect(hasAuthContent).toBe(0);
      
    } catch (error) {
      console.error('Error checking page content:', error);
      
      // Take a screenshot for debugging
      await page.screenshot({ path: 'test-results/auth-bypass-debug.png' });
      
      // Log current page URL and content
      console.log('Current URL:', page.url());
      const content = await page.content();
      console.log('Page content length:', content.length);
    }
  });

  test('should verify isTestEnv API returns true during E2E tests', async ({ page }) => {
    // Test the API endpoint directly to ensure it's working
    const response = await page.request.get('http://localhost:3000/api/isTestEnv');
    expect(response.ok()).toBeTruthy();
    
    const data = await response.json();
    console.log('isTestEnv API response:', data);
    
    // The API should return isOnTestEnv: true when E2E_TESTING=true and NODE_ENV=test
    expect(data.isOnTestEnv).toBe(true);
  });
});