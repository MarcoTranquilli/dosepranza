import { test, expect } from '@playwright/test';

test('UAT Utente standard: ordine + frige', async ({ page }) => {
  await page.goto('/');

  await page.click('#btn-menu');
  await page.click('[data-action="add-std"]');

  await page.click('#btn-cart');
  const confirm = page.locator('[data-action="send-order"]');
  await confirm.click();

  await page.click('#btn-frige');
  const buy = page.locator('[data-action="frige-open-modal"]').first();
  await buy.click();
  await page.check('#frige-paid-check');
  await page.click('[data-action="confirm-frige"]');

  await expect(page.locator('#toast')).toBeVisible();
});
