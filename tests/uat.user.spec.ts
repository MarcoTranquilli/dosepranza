import { test, expect } from '@playwright/test';

test('UAT Utente standard: ordine + frige WIP', async ({ page }) => {
  await page.goto('/');

  await page.click('#btn-menu');
  await page.click('[data-action="add-std"]');

  await page.click('#btn-cart');
  const confirm = page.locator('[data-action="send-order"]');
  await confirm.click();

  await page.click('#btn-menu');
  await expect(page.locator('#btn-frige')).toHaveClass(/nav-disabled/);
  await expect(page.locator('#frige-wip')).toBeVisible();

  await expect(page.locator('#toast')).toBeVisible();
});
