import { defineConfig, devices } from '@playwright/test';

// When PLAYWRIGHT_BASE_URL is set we assume an already-running server (CI or a
// container) and skip the managed webServer entirely. Otherwise Playwright
// builds nothing but starts the production server itself.
const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';
const useExternalServer = Boolean(process.env.PLAYWRIGHT_BASE_URL);

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // Content is written to disk by several flows, so keep CI serial to avoid
  // read/write races on the shared content directory.
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'html',
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  // Chromium only: CI installs just that browser, WebKit rejects the
  // `Secure` session cookie over plain-HTTP, and narrow-screen behavior is
  // covered explicitly by the responsive test via setViewportSize().
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: useExternalServer
    ? undefined
    : {
        command: 'npm run start',
        url: 'http://localhost:3000',
        reuseExistingServer: !process.env.CI,
        timeout: 120000,
      },
});
