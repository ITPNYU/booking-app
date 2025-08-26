# E2E Testing with Authentication Bypass

This document explains the authentication bypass mechanism implemented for E2E testing in the booking app.

## Overview

The booking app now supports skipping authentication during E2E tests, allowing automated tests to run without manual Google login. This is accomplished through environment variable detection and mock user creation.

## Implementation Details

### 1. Environment Variables

The following environment variables enable authentication bypass:

- `BYPASS_AUTH=true` - Explicitly enable authentication bypass
- `E2E_TESTING=true` - Indicate E2E testing is active
- `NODE_ENV=test` - Indicate test environment (optional, as Next.js dev server overrides this)

### 2. API Endpoint

The `/api/isTestEnv` endpoint checks for bypass conditions:

```javascript
const isE2ETesting = process.env.NODE_ENV === "test" && process.env.E2E_TESTING === "true";
const bypassAuth = process.env.BYPASS_AUTH === "true";

if (isE2ETesting || bypassAuth) {
  return NextResponse.json({ isOnTestEnv: true });
}
```

### 3. Client-Side Authentication Bypass

The `AuthProvider` component was modified to create a mock user when in test environment:

```javascript
if (isOnTestEnv) {
  console.log("Test environment detected, creating mock user");
  const mockUser = {
    uid: "test-user-id",
    email: "test@nyu.edu", 
    displayName: "Test User",
    photoURL: null,
    emailVerified: true,
  } as User;
  setUser(mockUser);
  setLoading(false);
  return;
}
```

### 4. Firebase Client Modifications

The Firebase client was updated to:
- Detect test environment from environment variables
- Skip Firebase initialization when in test mode
- Return mock auth objects for test scenarios
- Provide mock users from `signInWithGoogle()` in test mode

### 5. Playwright Configuration

The Playwright configuration includes:
- Global setup to set environment variables
- Environment variable passing to tests
- Optional web server configuration

## Usage

### Starting the Development Server for E2E Tests

```bash
BYPASS_AUTH=true E2E_TESTING=true npm run dev
```

### Running E2E Tests

```bash
npx playwright test
```

The tests will automatically use the authentication bypass when the environment variables are set.

### Example E2E Test

```javascript
test('should bypass authentication for E2E tests', async ({ request }) => {
  // Verify bypass is enabled
  const response = await request.get('http://localhost:3000/api/isTestEnv');
  const data = await response.json();
  expect(data.isOnTestEnv).toBe(true);
  
  // Proceed with test without manual authentication
  // The app will automatically create a mock user: test@nyu.edu
});
```

## Files Modified

1. `app/api/isTestEnv/route.ts` - API endpoint for bypass detection
2. `components/src/client/routes/components/AuthProvider.tsx` - Mock user creation
3. `lib/firebase/firebaseClient.ts` - Firebase bypass logic
4. `playwright.config.ts` - E2E test configuration
5. `tests/e2e/global-setup.ts` - Environment variable setup
6. `tests/e2e/auth-bypass*.e2e.test.ts` - Example E2E tests
7. `.env.test.local` - Test environment configuration

## Security Considerations

- Authentication bypass only works when explicit environment variables are set
- The bypass requires both `BYPASS_AUTH=true` and/or `E2E_TESTING=true`
- Mock users are clearly identified with test email addresses
- The bypass is disabled by default in production environments

## Benefits

1. **No Manual Authentication**: E2E tests run without human intervention
2. **Faster Test Execution**: No waiting for OAuth flows
3. **Reliable Testing**: No dependency on external authentication services
4. **CI/CD Friendly**: Tests can run in automated environments
5. **Debugging Friendly**: Consistent test user for debugging

## Verification

The implementation can be verified by:
1. Setting the environment variables
2. Checking the `/api/isTestEnv` endpoint returns `{"isOnTestEnv": true}`
3. Running the E2E tests to confirm they pass without manual authentication
4. Verifying mock users are created automatically in test scenarios