import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  testMatch: 'pagnottella.production.spec.ts',
  timeout: 45_000,
  use: {
    baseURL: 'http://127.0.0.1:8083/pagnottella-gourmet/',
    trace: 'retain-on-failure'
  },
  webServer: {
    command: 'npm run build:pagnottella-production && python3 -m http.server 8083 --bind 127.0.0.1 --directory dist-production',
    url: 'http://127.0.0.1:8083/pagnottella-gourmet/',
    reuseExistingServer: true
  },
  projects: [
    { name:'desktop', use:{...devices['Desktop Chrome']} },
    { name:'mobile', use:{...devices['iPhone 13']} },
    { name:'webkit', use:{...devices['Desktop Safari']} }
  ]
});
