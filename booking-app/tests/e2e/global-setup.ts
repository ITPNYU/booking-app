import { FullConfig } from '@playwright/test';

async function globalSetup(config: FullConfig) {
  // Set environment variables for E2E testing authentication bypass
  // Note: NODE_ENV is set externally and may be read-only
  process.env.E2E_TESTING = 'true';
  process.env.BYPASS_AUTH = 'true';
  
  // Set Firebase environment variables for E2E testing
  // These prevent "The default Firebase app does not exist" errors
  process.env.NEXT_PUBLIC_FIREBASE_API_KEY = 'test-api-key';
  process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN = 'test.firebaseapp.com';
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = 'test-project';
  process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET = 'test.appspot.com';
  process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID = '123456789';
  process.env.NEXT_PUBLIC_FIREBASE_APP_ID = 'test-app-id';
  process.env.NEXT_PUBLIC_MEASUREMENT_ID = 'test-measurement-id';
  process.env.NEXT_PUBLIC_DATABASE_NAME = 'test-database';
  process.env.NEXT_PUBLIC_BRANCH_NAME = 'development-local';
  
  console.log('🚀 E2E Global Setup: Configuring authentication bypass environment');
  console.log('NODE_ENV:', process.env.NODE_ENV || 'not set');
  console.log('E2E_TESTING:', process.env.E2E_TESTING);
  console.log('BYPASS_AUTH:', process.env.BYPASS_AUTH);
  
  console.log('🔥 Firebase Environment Variables Configured:');
  console.log('NEXT_PUBLIC_FIREBASE_PROJECT_ID:', process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID);
  console.log('NEXT_PUBLIC_BRANCH_NAME:', process.env.NEXT_PUBLIC_BRANCH_NAME);
  
  // Verify environment is properly configured
  if (process.env.BYPASS_AUTH === 'true' && process.env.E2E_TESTING === 'true') {
    console.log('✅ Authentication bypass environment properly configured');
  } else {
    console.log('⚠️ Warning: Authentication bypass environment may not be properly configured');
  }
  
  if (process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID && process.env.NEXT_PUBLIC_FIREBASE_API_KEY) {
    console.log('✅ Firebase environment properly configured for E2E tests');
  } else {
    console.log('⚠️ Warning: Firebase environment may not be properly configured');
  }
}

export default globalSetup;