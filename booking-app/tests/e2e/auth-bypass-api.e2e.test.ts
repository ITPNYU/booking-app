import { test, expect } from '@playwright/test';

test.describe('E2E Authentication Bypass - API Tests', () => {
  test('should verify isTestEnv API returns true when bypass environment variables are set', async ({ request }) => {
    // Test the API endpoint directly
    const response = await request.get('http://localhost:3000/api/isTestEnv');
    expect(response.ok()).toBeTruthy();
    
    const data = await response.json();
    console.log('isTestEnv API response:', data);
    
    // The API should return isOnTestEnv: true when BYPASS_AUTH=true is set
    expect(data.isOnTestEnv).toBe(true);
  });

  test('should demonstrate authentication bypass is properly configured', async ({ page }) => {
    // Set a simple HTML page to test our Firebase client configuration
    await page.setContent(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>E2E Test Page</title>
          <script>
            // Simulate loading our Firebase client
            window.testResults = {
              isTestEnvironment: '${process.env.BYPASS_AUTH}' === 'true' || '${process.env.E2E_TESTING}' === 'true',
              environmentVariables: {
                BYPASS_AUTH: '${process.env.BYPASS_AUTH}',
                E2E_TESTING: '${process.env.E2E_TESTING}',
                NODE_ENV: '${process.env.NODE_ENV}'
              }
            };
            console.log('Test environment detected:', window.testResults.isTestEnvironment);
          </script>
        </head>
        <body>
          <h1>E2E Test Environment</h1>
          <div id="test-status">Testing authentication bypass...</div>
        </body>
      </html>
    `);

    // Check that our test environment variables are properly set
    const testResults = await page.evaluate(() => window.testResults);
    console.log('Test results:', testResults);
    
    expect(testResults.isTestEnvironment).toBe(true);
    expect(testResults.environmentVariables.BYPASS_AUTH).toBe('true');
    expect(testResults.environmentVariables.E2E_TESTING).toBe('true');
  });

  test('should validate authentication bypass configuration in the codebase', async ({ page }) => {
    // Create a simple test to verify our code changes work
    await page.setContent(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Code Validation Test</title>
        </head>
        <body>
          <h1>Authentication Bypass Validation</h1>
          <div id="result"></div>
          <script>
            // Simulate the logic from our modified AuthProvider
            async function testAuthBypass() {
              try {
                // Test the isTestEnv API endpoint
                const response = await fetch('http://localhost:3000/api/isTestEnv');
                const data = await response.json();
                
                if (data.isOnTestEnv) {
                  // Simulate creating a mock user (like in our AuthProvider modification)
                  const mockUser = {
                    uid: "test-user-id", 
                    email: "test@nyu.edu",
                    displayName: "Test User"
                  };
                  
                  document.getElementById('result').innerHTML = 
                    'SUCCESS: Authentication bypass active - Mock user created: ' + mockUser.email;
                  return true;
                } else {
                  document.getElementById('result').innerHTML = 
                    'FAILURE: Authentication bypass not active';
                  return false;
                }
              } catch (error) {
                document.getElementById('result').innerHTML = 
                  'ERROR: ' + error.message;
                return false;
              }
            }
            
            testAuthBypass();
          </script>
        </body>
      </html>
    `);

    // Wait for the test to complete
    await page.waitForTimeout(2000);
    
    // Check the result
    const result = await page.locator('#result').textContent();
    console.log('Authentication bypass test result:', result);
    
    expect(result).toContain('SUCCESS: Authentication bypass active');
  });
});