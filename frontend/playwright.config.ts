import { defineConfig, devices } from '@playwright/test';

const DEPLOYED_URL = process.env['PLAYWRIGHT_BASE_URL'];
/** The French build (US-13): /fr/ when deployed; locally `npm run start:fr` serves it at the root of :4201. */
const FRENCH_URL = DEPLOYED_URL ? `${DEPLOYED_URL.replace(/\/+$/, '')}/fr/` : 'http://localhost:4201/';
const FRENCH_SPECS = /i18n-fr\.spec\.ts/;
/**
 * Playwright's WebKit build for Windows crashes pages that Safari and WebKit on Linux render fine (frontend AGENTS.md
 * R27), so the WebKit projects run off Windows (CI, WSL, macOS) unless E2E_WEBKIT=1 asks for them anyway.
 */
const WEBKIT = process.platform !== 'win32' || process.env['E2E_WEBKIT'] === '1';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30 * 1000,
  expect: {
    timeout: 5000
  },
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  // Retries on CI collect a trace, but a test that only passes on retry still fails the run: flakes get fixed, not hidden.
  retries: process.env['CI'] ? 2 : 0,
  failOnFlakyTests: !!process.env['CI'],
  workers: process.env['CI'] ? 1 : undefined,
  outputDir: 'test-results',
  reporter: [
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['list']
  ],
  use: {
    baseURL: DEPLOYED_URL || 'http://localhost:4200',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  },
  // The French specs run once, in their own project; every other project runs the rest.
  testIgnore: FRENCH_SPECS,
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    },
    {
      name: 'chromium-fr',
      testIgnore: [],
      testMatch: FRENCH_SPECS,
      use: { ...devices['Desktop Chrome'], baseURL: FRENCH_URL, locale: 'fr-FR' }
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] }
    },
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] }
    },
    ...(WEBKIT
      ? [
          {
            name: 'webkit',
            use: { ...devices['Desktop Safari'] }
          },
          {
            name: 'Mobile Safari',
            use: { ...devices['iPhone 12'] }
          }
        ]
      : [])
  ],
  // Against a deployed environment (PLAYWRIGHT_BASE_URL, e.g. `npm run e2e:staging`) no local server is started.
  webServer: DEPLOYED_URL
    ? undefined
    : [
        { command: 'npm run start', url: 'http://localhost:4200', reuseExistingServer: true, timeout: 120 * 1000 },
        { command: 'npm run start:fr', url: 'http://localhost:4201', reuseExistingServer: true, timeout: 120 * 1000 }
      ]
});
