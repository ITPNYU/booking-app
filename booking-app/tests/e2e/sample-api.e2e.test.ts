import { test, expect } from '@playwright/test';

test('verify E2E environment and authentication bypass are working', async ({ request }) => {
  console.log('🔍 Verifying E2E environment and authentication bypass...');
  
  // Test the API endpoint directly to ensure it's accessible
  const response = await request.get('http://localhost:3000/api/isTestEnv');
  expect(response.ok()).toBeTruthy();
  
  const data = await response.json();
  expect(data.isOnTestEnv).toBe(true);
  console.log('✅ Authentication bypass API is working correctly');

  // Test API reliability with multiple calls
  console.log('🔍 Testing API reliability...');
  const reliabilityTests = [];
  for (let i = 0; i < 3; i++) {
    reliabilityTests.push(request.get('http://localhost:3000/api/isTestEnv'));
  }
  
  const responses = await Promise.all(reliabilityTests);
  for (const response of responses) {
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.isOnTestEnv).toBe(true);
  }
  
  console.log('✅ API reliability confirmed - all concurrent requests succeeded');
  console.log('✅ E2E environment is properly configured for automated testing');
});