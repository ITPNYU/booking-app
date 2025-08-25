import { NextResponse } from "next/server";

export const GET = async () => {
  try {
    // Enable test environment in the following scenarios:
    // 1. CI environment with development branch
    // 2. E2E testing mode (NODE_ENV=test and E2E_TESTING=true)
    // 3. Explicitly set BYPASS_AUTH=true for local testing
    const isCI = process.env.CI === "true";
    const isDevelopmentBranch =
      process.env.NEXT_PUBLIC_BRANCH_NAME === "development";
    const isE2ETesting =
      process.env.NODE_ENV === "test" && process.env.E2E_TESTING === "true";
    const bypassAuth = process.env.BYPASS_AUTH === "true";

    if ((isCI && isDevelopmentBranch) || isE2ETesting || bypassAuth) {
      return NextResponse.json({ isOnTestEnv: true });
    }
  } catch (error) {
    console.error("Error in isTestEnv API:", error);
    return NextResponse.json({ isOnTestEnv: false });
  }

  return NextResponse.json({ isOnTestEnv: false });
};
