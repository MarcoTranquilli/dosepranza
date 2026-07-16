import { test, expect } from '@playwright/test';
import { seedMultiSupplierOrders } from './helpers/e2e-fixtures';
import { legacyRussoAppUrl } from './helpers/routes';

test('UAT Admin: analytics + export', async ({ page }) => {
  await seedMultiSupplierOrders(page);
  await page.goto(legacyRussoAppUrl);

  await page.click('#btn-history');
  await expect(page.locator('#orders-summary-count')).toHaveText('3 ordini · 7 pezzi');
  await expect(page.locator('#grand-total-display')).toHaveText('€19.40');
  await expect(page.locator('#all-orders-list')).toContainText('La Pagnottella Gourmet');
  await expect(page.locator('#all-orders-list')).toContainText('Saporito');

  await page.click('#btn-analytics');
  await expect(page.locator('#analytics-view')).toBeVisible();

  await page.click('[data-action="analytics-range"][data-range="7d"]');
  await page.click('[data-action="analytics-export-csv"]');

  await page.click('[data-action="analytics-export-pdf"]');
});
