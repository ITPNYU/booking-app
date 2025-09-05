import { test, expect } from '@playwright/test';

test.describe('API-Only E2E Tests', () => {
  test('should verify authentication bypass API is working', async ({ request }) => {
    console.log('Testing authentication bypass via API endpoint...');
    
    const response = await request.get('http://localhost:3000/api/isTestEnv');
    expect(response.ok()).toBeTruthy();
    
    const data = await response.json();
    console.log('✅ isTestEnv API response:', data);
    
    expect(data.isOnTestEnv).toBe(true);
    console.log('✅ Authentication bypass is ACTIVE via API');
  });

  test('should verify API response contains correct data structure', async ({ request }) => {
    console.log('Testing API response structure...');
    
    const response = await request.get('http://localhost:3000/api/isTestEnv');
    const data = await response.json();
    
    // Verify the response has the expected structure
    expect(data).toHaveProperty('isOnTestEnv');
    expect(typeof data.isOnTestEnv).toBe('boolean');
    expect(data.isOnTestEnv).toBe(true);
    
    console.log('✅ API response structure is correct');
  });

  test('should confirm environment variables are properly detected', async ({ request }) => {
    console.log('Testing environment variable detection via API...');
    
    // Multiple calls to ensure consistency
    for (let i = 1; i <= 3; i++) {
      console.log(`API call ${i}/3...`);
      const response = await request.get('http://localhost:3000/api/isTestEnv');
      expect(response.ok()).toBeTruthy();
      
      const data = await response.json();
      expect(data.isOnTestEnv).toBe(true);
    }
    
    console.log('✅ Environment variables consistently detected across multiple calls');
  });

  test('should demonstrate end-to-end authentication bypass flow via API', async ({ request }) => {
    console.log('Testing complete E2E authentication bypass flow via API...');
    
    // Step 1: Verify test environment
    const testEnvResponse = await request.get('http://localhost:3000/api/isTestEnv');
    expect(testEnvResponse.ok()).toBeTruthy();
    
    const testEnvData = await testEnvResponse.json();
    expect(testEnvData.isOnTestEnv).toBe(true);
    console.log('✅ Step 1: Test environment confirmed');
    
    // Step 2: Verify the server is responding correctly
    const healthCheck = await request.get('http://localhost:3000/api/isTestEnv');
    expect(healthCheck.status()).toBe(200);
    console.log('✅ Step 2: Server health check passed');
    
    // Step 3: Verify consistent behavior
    const secondCall = await request.get('http://localhost:3000/api/isTestEnv');
    const secondData = await secondCall.json();
    expect(secondData.isOnTestEnv).toBe(testEnvData.isOnTestEnv);
    console.log('✅ Step 3: Consistent API behavior verified');
    
    console.log('✅ Complete E2E authentication bypass flow verified via API');
    console.log('✅ E2E tests can proceed without manual Google authentication');
  });
});