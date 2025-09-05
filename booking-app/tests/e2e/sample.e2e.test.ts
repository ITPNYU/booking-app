import { test, expect } from '@playwright/test';

test('verify E2E environment and authentication bypass are working', async ({ page, request }) => {
  // First, test the API endpoint directly to ensure it's accessible
  const response = await request.get('http://localhost:3000/api/isTestEnv');
  expect(response.ok()).toBeTruthy();
  
  const data = await response.json();
  expect(data.isOnTestEnv).toBe(true);
  console.log('✅ Authentication bypass API is working correctly');

  // Create a simple test page to verify that browser interactions work
  await page.setContent(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>E2E Test Environment Verification</title>
      </head>
      <body>
        <h1>E2E Testing Environment</h1>
        <div id="test-result">Testing...</div>
        <script>
          async function verifyEnvironment() {
            try {
              const response = await fetch('http://localhost:3000/api/isTestEnv');
              const data = await response.json();
              
              if (data.isOnTestEnv) {
                document.getElementById('test-result').innerHTML = 
                  'SUCCESS: E2E environment verified - Authentication bypass active';
                document.body.setAttribute('data-test-status', 'success');
              } else {
                document.getElementById('test-result').innerHTML = 
                  'FAILED: Authentication bypass not active';
                document.body.setAttribute('data-test-status', 'failed');
              }
            } catch (error) {
              document.getElementById('test-result').innerHTML = 
                'ERROR: ' + error.message;
              document.body.setAttribute('data-test-status', 'error');
            }
          }
          verifyEnvironment();
        </script>
      </body>
    </html>
  `);

  await page.waitForTimeout(1000);
  
  const testResult = await page.locator('#test-result').textContent();
  const testStatus = await page.getAttribute('body', 'data-test-status');
  
  expect(testResult).toContain('SUCCESS');
  expect(testStatus).toBe('success');
  
  console.log('✅ Browser-based E2E test verification completed successfully');
});