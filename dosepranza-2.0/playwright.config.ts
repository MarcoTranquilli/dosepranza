import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 60000,
  expect: { timeout: 10000 },
  workers: 1,
  reporter: [
    ['line'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['json', { outputFile: 'playwright-report/results.json' }]
  ],
  outputDir: 'test-results',
  use: {
    baseURL: process.env.BASE_URL || 'http://127.0.0.1:8081',
    headless: true,
    viewport: { width: 1280, height: 720 }
  },
  projects: [
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/
    },
    {
      name: 'user',
      dependencies: ['setup'],
      use: { storageState: 'tests/.auth/user.json' },
      testMatch: /.*uat\.user\.spec\.ts/
    },
    {
      name: 'facility',
      dependencies: ['setup'],
      use: { storageState: 'tests/.auth/facility.json' },
      testMatch: /.*uat\.facility\.spec\.ts/
    },
    {
      name: 'ristoratore',
      dependencies: ['setup'],
      use: { storageState: 'tests/.auth/ristoratore.json' },
      testMatch: /.*uat\.ristoratore\.spec\.ts/
    },
    {
      name: 'admin',
      dependencies: ['setup'],
      use: { storageState: 'tests/.auth/admin.json' },
      testMatch: /.*uat\.admin\.spec\.ts/
    }
  ]
});
