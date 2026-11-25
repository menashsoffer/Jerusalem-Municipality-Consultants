// Browser tests of the main journeys against a local Supabase (`supabase start`).
// documentation/e2e-tests-he.md explains how to run them; CI runs them in tests.yml.
import { defineConfig, devices } from '@playwright/test';
import { env } from './e2e/support/env.ts';

const site = 'http://127.0.0.1:5173';
const build = 'vite build --outDir ../e2e-dist';
const serve = `vite preview --outDir ../e2e-dist --port 5173 --strictPort --host 127.0.0.1`;

export default defineConfig({
  testDir: 'e2e/tests',
  testMatch: '*-test.ts',
  globalSetup: './e2e/support/global-setup.ts',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: site,
    locale: 'he-IL',
    timezoneId: 'Asia/Jerusalem',
    trace: 'retain-on-failure',
    ...devices['Desktop Chrome'],
  },
  webServer: {
    command: `npx ${build} && npx ${serve}`,
    url: site,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: {
      VITE_SUPABASE_URL: env('E2E_API_URL'),
      VITE_SUPABASE_PUBLISHABLE_KEY: env('E2E_PUBLISHABLE_KEY'),
    },
  },
});
