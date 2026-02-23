import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  testMatch: "**/*.e2e.test.ts",
  timeout: 120000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 3 : 1,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [["list"], ["github"], ["html"]] : [["list"]],

  globalSetup: require.resolve("./tests/e2e/global-setup.ts"),

  use: {
    headless: process.env.CI ? true : false,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: process.env.CI ? "off" : "retain-on-failure",
    baseURL: "http://localhost:3000",

    launchOptions: {
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        ...(process.env.CI
          ? [
              "--disable-extensions",
              "--no-first-run",
            ]
          : []),
      ],
      slowMo: process.env.CI ? 100 : 0,
    },

    navigationTimeout: 90000,
    actionTimeout: 45000,
    viewport: { width: 1280, height: 720 },
    ignoreHTTPSErrors: true,
  },

  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
      },
    },
    {
      name: "use-case-flows",
      testMatch: [
        "**/booking-flow.e2e.test.ts",
        "**/walk-in-flow.e2e.test.ts",
        "**/vip-flow.e2e.test.ts",
        "**/auto-approval.e2e.test.ts",
        "**/calendar-constraints.e2e.test.ts",
        "**/liaison-first-approve.e2e.test.ts",
        "**/admin-final-approve.e2e.test.ts",
        // "**/services-approve.e2e.test.ts", // TODO: fix combobox click timeout after first service approval
        "**/status-transitions.e2e.test.ts",
        "**/approve-decline-pages.e2e.test.ts",
      ],
      use: {
        ...devices["Desktop Chrome"],
      },
    },
  ],

  webServer: {
    command: "npm run dev",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
    env: {
      ...process.env,
      E2E_TESTING: "true",
      BYPASS_AUTH: "true",
    },
  },
});
