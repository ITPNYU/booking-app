import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.e2e.test.ts',
  timeout: 120000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',

  // Set environment variables for E2E testing authentication bypass
  globalSetup: require.resolve('./tests/e2e/global-setup.ts'),

  use: {
    headless: process.env.CI ? true : false,
    trace: 'on-first-retry',

    // Set environment variables for E2E tests
    extraHTTPHeaders: {
      'x-test-env': 'true',
    },

    // Add these new configurations
    launchOptions: {
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-popup-blocking',  // Allow popups
        '--start-maximized'          // Ensure window is large enough

      ],
      slowMo: process.env.CI ? 100 : 0,
      env: {
        NODE_ENV: 'test',
        E2E_TESTING: 'true',
      },
      // Try to use system Chromium if available, especially in CI
      executablePath: (() => {
        if (process.env.CI) {
          // In CI, try multiple browser paths as fallback
          const possiblePaths = [
            '/usr/bin/chromium-browser',
            '/usr/bin/chromium',
            '/usr/bin/google-chrome',
            '/snap/bin/chromium',
          ];
          
          for (const browserPath of possiblePaths) {
            try {
              const fs = require('fs');
              if (fs.existsSync(browserPath)) {
                console.log('Using system browser in CI:', browserPath);
                return browserPath;
              }
            } catch (e) {
              // Continue to next path
            }
          }
          
          console.log('No system browser found in CI, using Playwright browser');
          return undefined;
        } else {
          // For local development
          try {
            const { execSync } = require('child_process');
            const chromiumPath = execSync('which chromium-browser || which chromium || which google-chrome', { encoding: 'utf8' }).trim();
            console.log('Using system browser:', chromiumPath);
            return chromiumPath;
          } catch (e) {
            console.log('System browser not found, using Playwright browser');
            return undefined;
          }
        }
      })(),
    },

    // Increase timeouts for CI environment
    navigationTimeout: 60000,
    actionTimeout: 30000,

    // Additional helpful options for CI
    viewport: { width: 1280, height: 720 },
    ignoreHTTPSErrors: true,

    // Video recording can help debug CI issues
    video: process.env.CI ? 'retain-on-failure' : 'off',
    screenshot: process.env.CI ? 'only-on-failure' : 'off',
  },

  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        contextOptions: {
          reducedMotion: 'reduce',
          forcedColors: 'active',
        },
      },
    },
    /* {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },

    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    }, */

    /* Test against mobile viewports. */
    // {
    //   name: 'Mobile Chrome',
    //   use: { ...devices['Pixel 5'] },
    // },
    // {
    //   name: 'Mobile Safari',
    //   use: { ...devices['iPhone 12'] },
    // },

    /* Test against branded browsers. */
    // {
    //   name: 'Microsoft Edge',
    //   use: { ...devices['Desktop Edge'], channel: 'msedge' },
    // },
    // {
    //   name: 'Google Chrome',
    //   use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    // },
  ],

  /* Run your local dev server before starting the tests */
  // Note: Start dev server manually with: NODE_ENV=test E2E_TESTING=true npm run dev
  // webServer: {
  //   command: 'npm run dev',
  //   url: 'http://127.0.0.1:3000',
  //   reuseExistingServer: !process.env.CI,
  //   timeout: 120 * 1000,
  //   env: {
  //     NODE_ENV: 'test',
  //     E2E_TESTING: 'true',
  //   },
  // },
});
