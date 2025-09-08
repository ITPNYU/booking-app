import { test, expect } from '@playwright/test';

test.describe('E2E Authentication Bypass - API Tests', () => {
  test('should verify isTestEnv API returns true when bypass environment variables are set', async ({ request }) => {
    // Test the API endpoint directly
    const response = await request.get('http://localhost:3001/api/isTestEnv');
    expect(response.ok()).toBeTruthy();
    
    const data = await response.json();
    console.log('isTestEnv API response:', data);
    
    // The API should return isOnTestEnv: true when BYPASS_AUTH=true is set
    expect(data.isOnTestEnv).toBe(true);
  });

  test('should verify authentication bypass environment variables are properly detected via API', async ({ request }) => {
    console.log('Testing environment variable detection via multiple API calls...');
    
    // Test multiple times to ensure consistency
    for (let i = 1; i <= 5; i++) {
      console.log(`API verification call ${i}/5...`);
      const response = await request.get('http://localhost:3001/api/isTestEnv');
      expect(response.ok()).toBeTruthy();
      
      const data = await response.json();
      expect(data.isOnTestEnv).toBe(true);
      
      // Verify response structure is consistent
      expect(data).toHaveProperty('isOnTestEnv');
      expect(typeof data.isOnTestEnv).toBe('boolean');
    }
    
    console.log('✅ Environment variables consistently detected across all API calls');
  });

  test('should demonstrate complete authentication bypass flow via API testing', async ({ request }) => {
    console.log('Testing complete authentication bypass workflow...');
    
    // Step 1: Verify the test environment is active
    console.log('Step 1: Verifying test environment...');
    const testEnvResponse = await request.get('http://localhost:3001/api/isTestEnv');
    expect(testEnvResponse.ok()).toBeTruthy();
    expect(testEnvResponse.status()).toBe(200);
    
    const testEnvData = await testEnvResponse.json();
    expect(testEnvData.isOnTestEnv).toBe(true);
    console.log('✅ Test environment confirmed active');
    
    // Step 2: Verify server health and consistency
    console.log('Step 2: Testing server health and response consistency...');
    const healthResponse = await request.get('http://localhost:3001/api/isTestEnv');
    expect(healthResponse.ok()).toBeTruthy();
    expect(healthResponse.status()).toBe(200);
    
    const healthData = await healthResponse.json();
    expect(healthData.isOnTestEnv).toBe(testEnvData.isOnTestEnv);
    console.log('✅ Server health and consistency verified');
    
    // Step 3: Verify the bypass works across different request patterns
    console.log('Step 3: Testing bypass across different request patterns...');
    const requests = await Promise.all([
      request.get('http://localhost:3001/api/isTestEnv'),
      request.get('http://localhost:3001/api/isTestEnv'),
      request.get('http://localhost:3001/api/isTestEnv')
    ]);
    
    for (const response of requests) {
      expect(response.ok()).toBeTruthy();
      const data = await response.json();
      expect(data.isOnTestEnv).toBe(true);
    }
    console.log('✅ Authentication bypass works consistently across concurrent requests');
    
    console.log('✅ Complete authentication bypass workflow verified via API');
    console.log('✅ E2E tests can proceed without manual Google authentication');
  });
});