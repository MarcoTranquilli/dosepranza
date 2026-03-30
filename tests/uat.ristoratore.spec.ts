import { test, expect } from '@playwright/test';
import { seedCoreOrders } from './helpers/e2e-fixtures';

test('UAT Ristoratore: gestione frige + riconciliazione', async ({ page }) => {
  await seedCoreOrders(page);
  await page.goto('/');

  await page.click('#btn-frige');
  const price = page.locator('[data-action="frige-update-price"]').first();
  if (await price.isVisible()) {
    page.once('dialog', dialog => dialog.dismiss());
    await price.click();
  }

  await page.click('#btn-history');
  await expect(page.locator('#orders-payments-list')).toBeVisible();
  await expect(page.locator('#orders-summary-count')).toHaveText('2 ordini · 6 pezzi');
  await expect(page.locator('#orders-kpi-unpaid')).toHaveText('2');
  await expect(page.locator('#orders-kpi-unpaid-amt')).toHaveText('€13.00');
  await expect(page.locator('#orders-summary-products')).toContainText('Ovoline di bufala 150g');
  await expect(page.locator('#orders-payments-list')).toContainText('Gabriele Maria Cirulli');
  await expect(page.locator('#orders-payments-list')).toContainText('Lorenzo Zuaro');
});
