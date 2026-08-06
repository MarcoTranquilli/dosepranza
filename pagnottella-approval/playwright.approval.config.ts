import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  testMatch: /pagnottella\.approval\.spec\.ts/,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  workers: 1,
  reporter: [['line']],
  outputDir: 'test-results/approval',
  use: {
    baseURL: process.env.BASE_URL || 'http://127.0.0.1:8082',
    headless: true
  },
  projects: [
    {
      name: 'desktop',
      use: { viewport: { width: 1440, height: 900 } }
    },
    {
      name: 'mobile',
      use: { ...devices['Pixel 7'] }
    }
  ]
});
