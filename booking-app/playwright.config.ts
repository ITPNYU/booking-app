import { defineConfig, devices } from '@playwright/test';

// Helper function to find a working browser executable
function findBrowserExecutable() {
  const possiblePaths = [
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/snap/bin/chromium',
    '/opt/google/chrome/chrome',
  ];
  
  for (const browserPath of possiblePaths) {
    try {
      const fs = require('fs');
      if (fs.existsSync(browserPath)) {
        console.log('✅ Found system browser:', browserPath);
        return browserPath;
      }
    } catch (e) {
      // Continue to next path
    }
  }
  
  console.log('⚠️ No system browser found, using Playwright browser');
  return undefined;
}

export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.e2e.test.ts',
  timeout: 120000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 3 : 1, // Increased retries for CI stability
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['html'], ['github']] : 'html',

  // Set environment variables for E2E testing authentication bypass
  globalSetup: require.resolve('./tests/e2e/global-setup.ts'),

  use: {
    headless: process.env.CI ? true : false,
    trace: 'on-first-retry',

    // Set environment variables for E2E tests
    extraHTTPHeaders: {
      'x-test-env': 'true',
    },

    // Enhanced browser launch options for CI stability
    launchOptions: {
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-popup-blocking',
        '--disable-background-timer-throttling',
        '--disable-renderer-backgrounding',
        '--disable-backgrounding-occluded-windows',
        '--disable-web-security',
        '--start-maximized',
        '--disable-features=VizDisplayCompositor',
        ...(process.env.CI ? [
          '--disable-extensions',
          '--disable-plugins',
          '--no-first-run',
          '--no-default-browser-check',
          '--disable-component-update',
        ] : [])
      ],
      slowMo: process.env.CI ? 100 : 0,
      env: {
        NODE_ENV: 'test',
        E2E_TESTING: 'true',
        BYPASS_AUTH: 'true',
      },
      // Use system browser or fallback gracefully
      executablePath: findBrowserExecutable(),
      // Handle download behavior more gracefully
      downloadsPath: './test-results/downloads',
    },

    // Increased timeouts for better CI stability
    navigationTimeout: 90000,
    actionTimeout: 45000,
    
    // Additional helpful options for CI
    viewport: { width: 1280, height: 720 },
    ignoreHTTPSErrors: true,

    // Enhanced debugging for CI
    video: 'off', // Disable video to avoid ffmpeg issues
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

    // API-only project that doesn't require browser installation
    {
      name: 'api-only',
      testMatch: '**/api-only.e2e.test.ts',
      use: {
        // API tests don't need browser-specific configurations
        baseURL: 'http://localhost:3000',
      },
    },
  ],

  /* Run your local dev server before starting the tests */
  // Note: Start dev server manually with: BYPASS_AUTH=true E2E_TESTING=true npm run dev
  // webServer: {
  //   command: 'npm run dev',
  //   url: 'http://127.0.0.1:3000',
  //   reuseExistingServer: !process.env.CI,
  //   timeout: 120 * 1000,
  //   env: {
  //     NODE_ENV: 'test',
  //     E2E_TESTING: 'true',
  //     BYPASS_AUTH: 'true',
  //   },
  // },
});
