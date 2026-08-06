import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  testMatch: 'auth.production.spec.ts',
  timeout: 30_000,
  workers: 1,
  use: { headless: true },
  reporter: [['line']]
});
