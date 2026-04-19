// Forgentic (codename: Synterra) — Playwright E2E config.
//
// Runs against the locally-served `apps/web` (http://localhost:3000 by
// default, override with PLAYWRIGHT_BASE_URL). The `webServer` block that
// actually boots Next.js is deferred until apps/web lands in W0-1 §G — at
// that point we enable the commented block below.
//
// Projects: desktop-chromium, desktop-webkit, mobile-chromium (Pixel 5).
// Adding firefox is deferred — not worth the CI minutes for a
// Chromium-rendered Next.js SPA until we hit a known cross-browser bug.

import { defineConfig, devices } from '@playwright/test';

const isCI = Boolean(process.env['CI']);

export default defineConfig({
  testDir: '.',
  testMatch: /.*\.spec\.ts$/,

  // Full parallel everywhere; CI serialises inside a single worker only
  // when `--workers=1` is passed explicitly.
  fullyParallel: true,

  // Guard against `test.only` slipping past code review.
  forbidOnly: isCI,

  // Local: no retries (fail-fast feedback). CI: 2 retries to ride out
  // transient network/timing flakes before flagging.
  retries: isCI ? 2 : 0,

  // Workers: let Playwright pick (CPU-based) locally; cap at 2 on CI for
  // predictable wall-clock + fewer flakes from resource contention.
  workers: isCI ? 2 : undefined,

  timeout: 30_000,
  expect: {
    timeout: 5_000,
  },

  reporter: isCI
    ? [
        ['github'],
        ['html', { open: 'never', outputFolder: '../../playwright-report' }],
        ['json', { outputFile: '../../test-results/e2e-results.json' }],
        ['junit', { outputFile: '../../test-results/e2e-junit.xml' }],
      ]
    : [
        ['list'],
        ['html', { open: 'on-failure', outputFolder: '../../playwright-report' }],
      ],

  outputDir: '../../test-results',

  use: {
    baseURL: process.env['PLAYWRIGHT_BASE_URL'] ?? 'http://localhost:3000',

    // Trace on first retry keeps debug bundles small locally but forensic in CI.
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',

    // Respect user OS locale/timezone by pinning — reproducible snapshots.
    locale: 'en-US',
    timezoneId: 'UTC',

    // Accept self-signed certs when running against dev LXC behind Cloudflare
    // Tunnel (no-op in pure localhost runs).
    ignoreHTTPSErrors: true,
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'mobile-chromium',
      use: { ...devices['Pixel 5'] },
    },
  ],

  // webServer: enable once `apps/web` lands (W0-1 §G).
  //
  // webServer: {
  //   command: 'pnpm --filter @synterra/web dev',
  //   url: process.env['PLAYWRIGHT_BASE_URL'] ?? 'http://localhost:3000',
  //   reuseExistingServer: !isCI,
  //   timeout: 120_000,
  //   stdout: 'pipe',
  //   stderr: 'pipe',
  // },
});
