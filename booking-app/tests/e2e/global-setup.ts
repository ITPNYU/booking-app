import { FullConfig } from '@playwright/test';

async function globalSetup(config: FullConfig) {
  // Set environment variables for E2E testing authentication bypass
  // Note: NODE_ENV is set externally and may be read-only
  process.env.E2E_TESTING = 'true';
  process.env.BYPASS_AUTH = 'true';
  
  console.log('🚀 E2E Global Setup: Configuring authentication bypass environment');
  console.log('NODE_ENV:', process.env.NODE_ENV || 'not set');
  console.log('E2E_TESTING:', process.env.E2E_TESTING);
  console.log('BYPASS_AUTH:', process.env.BYPASS_AUTH);
  
  // Verify environment is properly configured
  if (process.env.BYPASS_AUTH === 'true' && process.env.E2E_TESTING === 'true') {
    console.log('✅ Authentication bypass environment properly configured');
  } else {
    console.log('⚠️ Warning: Authentication bypass environment may not be properly configured');
  }
}

export default globalSetup;