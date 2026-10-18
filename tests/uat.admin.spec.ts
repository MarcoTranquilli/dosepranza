import { test, expect } from '@playwright/test';
import { seedMultiSupplierOrders, coreOrdersFixture, pagnottellaOrderFixture } from './helpers/e2e-fixtures';
import { legacyRussoAppUrl } from './helpers/routes';

test('UAT Admin: analytics + export', async ({ page }) => {
  await seedMultiSupplierOrders(page);
  // Stub only the new data provider; render the real badge and calculate its real supplier-scoped total.
  await page.route('**/russo/threshold-status.js*', async route => {
    const response = await route.fetch();
    await route.fulfill({response, body:`${await response.text()}
      { const feature = window.DoseRussoThreshold;
        window.DoseRussoThreshold = Object.freeze({...feature, mount(element, options) {
          return feature.mount(element, {...options, getSummary:async () => {
            const now = new Date(), analytics = window.DoseOrderAnalytics;
            const rows = ${JSON.stringify([...coreOrdersFixture, pagnottellaOrderFixture])}.map(order => ({...order, createdAt:analytics.rangeFor('today', now).startDate}));
            return {...analytics.russoThreshold(rows, {now}), asOf:now.toISOString()};
          }});
        }});
      }`});
  });
  await page.goto(legacyRussoAppUrl);

  await page.click('#btn-cart');
  const threshold = page.locator('#russo-threshold-user');
  await expect(threshold).toBeVisible();
  await expect(threshold).toContainText(/13,00\s*€\s*\/\s*20,00\s*€/);
  await expect(threshold.locator('progress')).toHaveAttribute('max', '2000');
  await expect(threshold.locator('progress')).toHaveJSProperty('value', 1300);
  await page.click('#btn-history');
  await expect(page.locator('#orders-summary-count')).toHaveText('2 ordini · 6 pezzi');
  await expect(page.locator('#grand-total-display')).toHaveText('€13.00');
  await expect(page.locator('#all-orders-list')).not.toContainText('La Pagnottella Gourmet');
  await expect(page.locator('#all-orders-list')).not.toContainText('Saporito');

  await page.click('#btn-analytics');
  await expect(page.locator('#analytics-view')).toBeVisible();

  await page.click('[data-action="analytics-range"][data-range="7d"]');
  await page.click('[data-action="analytics-export-csv"]');

  await page.click('[data-action="analytics-export-pdf"]');
});
