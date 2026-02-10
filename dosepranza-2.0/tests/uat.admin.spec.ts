import { test, expect } from '@playwright/test';

test('UAT Admin: analytics + export', async ({ page }) => {
  await page.goto('/');

  await page.click('#btn-analytics');
  await expect(page.locator('#analytics-view')).toBeVisible();

  await page.click('[data-action="analytics-range"][data-range="7d"]');
  await page.click('[data-action="analytics-export-csv"]');

  await page.click('[data-action="analytics-export-pdf"]');
});
