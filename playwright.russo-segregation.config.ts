import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir:'./tests',
  testMatch:'russo.segregation.spec.ts',
  timeout:60_000,
  expect:{ timeout:12_000 },
  workers:1,
  reporter:[['line']],
  use:{
    baseURL:'http://127.0.0.1:8085',
    headless:true,
    viewport:{ width:1280, height:800 }
  },
  webServer:{
    command:'python3 -m http.server 8085 --bind 127.0.0.1 --directory .',
    url:'http://127.0.0.1:8085/russo/',
    reuseExistingServer:true
  }
});
