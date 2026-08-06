import { test, expect } from '@playwright/test';
import { seedMultiSupplierOrders } from './helpers/e2e-fixtures';
import { legacyRussoAppUrl } from './helpers/routes';

test('UAT Ristoratore: ordini Russo segregati e controlli admin esclusi', async ({ page }) => {
  await seedMultiSupplierOrders(page);
  await page.goto(legacyRussoAppUrl);

  await page.click('#btn-frige');
  const price = page.locator('[data-action="frige-update-price"]').first();
  if (await price.isVisible()) {
    page.once('dialog', dialog => dialog.dismiss());
    await price.click();
  }

  await page.click('#btn-history');
  await expect(page.locator('#history-ops-recon')).toBeHidden();
  await expect(page.locator('#btn-analytics')).toBeHidden();
  await expect(page.locator('#orders-summary-count')).toHaveText('2 ordini · 6 pezzi');
  await expect(page.locator('#orders-kpi-unpaid')).toHaveText('2');
  await expect(page.locator('#orders-kpi-unpaid-amt')).toHaveText('€13.00');
  await expect(page.locator('#orders-summary-products')).toContainText('Ovoline di bufala 150g');
  await expect(page.locator('#all-orders-list')).toContainText('Gabriele Maria Cirulli');
  await expect(page.locator('#all-orders-list')).toContainText('Lorenzo Zuaro');
  await expect(page.locator('#all-orders-list')).not.toContainText('La Pagnottella Gourmet');
  await expect(page.locator('#all-orders-list')).not.toContainText('Saporito');
});
