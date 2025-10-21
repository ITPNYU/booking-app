/**
 * Test environment detection utilities
 * Centralizes the logic for detecting various test environments
 */

/**
 * Check if we're in a test environment based on environment variables
 * This is a synchronous check that can be used during module initialization
 */
export const isTestEnvironment = (): boolean => {
  const bypassAuth = process.env.BYPASS_AUTH === "true";
  const e2eTesting = process.env.E2E_TESTING === "true";
  const nodeEnvTest = process.env.NODE_ENV === "test";

  const result = bypassAuth || e2eTesting || nodeEnvTest;

  // Debug logging (only in development/test)
  if (
    process.env.NODE_ENV === "development" ||
    process.env.NODE_ENV === "test"
  ) {
    console.log("🔍 Test Environment Detection:");
    console.log("  BYPASS_AUTH:", process.env.BYPASS_AUTH, "->", bypassAuth);
    console.log("  E2E_TESTING:", process.env.E2E_TESTING, "->", e2eTesting);
    console.log("  NODE_ENV:", process.env.NODE_ENV, "->", nodeEnvTest);
    console.log("  Result:", result);
  }

  return result;
};

/**
 * Check if we're in E2E testing mode specifically
 */
export const isE2ETesting = (): boolean => {
  return process.env.NODE_ENV === "test" && process.env.E2E_TESTING === "true";
};

/**
 * Check if we're in CI environment with development branch
 */
export const isCIDevelopment = (): boolean => {
  return (
    process.env.CI === "true" &&
    process.env.NEXT_PUBLIC_BRANCH_NAME === "development"
  );
};

/**
 * Check if authentication should be bypassed
 * This combines all the conditions that should enable test mode
 */
export const shouldBypassAuth = (): boolean => {
  return (
    isCIDevelopment() || isE2ETesting() || process.env.BYPASS_AUTH === "true"
  );
};

/**
 * Get test environment status for API responses
 */
export const getTestEnvironmentStatus = () => {
  const testEnvEnabled = shouldBypassAuth();

  if (testEnvEnabled) {
    console.log("Test environment: Authentication bypass enabled");
  }

  return {
    isOnTestEnv: testEnvEnabled,
    reasons: {
      ciDevelopment: isCIDevelopment(),
      e2eTesting: isE2ETesting(),
      bypassAuth: process.env.BYPASS_AUTH === "true",
    },
  };
};
