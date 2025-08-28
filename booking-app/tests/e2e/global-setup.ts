import { FullConfig } from '@playwright/test';

async function globalSetup(config: FullConfig) {
  // Set environment variables for E2E testing authentication bypass
  process.env.NODE_ENV = 'test';
  process.env.E2E_TESTING = 'true';
  
  console.log('E2E Global Setup: Setting environment variables for auth bypass');
  console.log('NODE_ENV:', process.env.NODE_ENV);
  console.log('E2E_TESTING:', process.env.E2E_TESTING);
}

export default globalSetup;