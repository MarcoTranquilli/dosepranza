import { test, expect } from '@playwright/test';
import { seedCoreOrders } from './helpers/e2e-fixtures';

test('UAT Admin: analytics + export', async ({ page }) => {
  await seedCoreOrders(page);
  await page.goto('/');

  await page.click('#btn-history');
  await expect(page.locator('#orders-summary-count')).toHaveText('2 ordini · 6 pezzi');
  await expect(page.locator('#grand-total-display')).toHaveText('€13.00');

  await page.click('#btn-analytics');
  await expect(page.locator('#analytics-view')).toBeVisible();

  await page.click('[data-action="analytics-range"][data-range="7d"]');
  await page.click('[data-action="analytics-export-csv"]');

  await page.click('[data-action="analytics-export-pdf"]');
});
