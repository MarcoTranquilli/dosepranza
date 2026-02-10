import { test, expect } from '@playwright/test';

test('UAT Ristoratore: gestione frige + riconciliazione', async ({ page }) => {
  await page.goto('/');

  await page.click('#btn-frige');
  const price = page.locator('[data-action="frige-update-price"]').first();
  if (await price.isVisible()) {
    page.once('dialog', dialog => dialog.dismiss());
    await price.click();
  }

  await page.click('#btn-history');
  await expect(page.locator('#orders-payments-list')).toBeVisible();
});
