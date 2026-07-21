import { test, expect } from '@playwright/test';
import { seedCoreOrders, seedUserOrders } from './helpers/e2e-fixtures';

test('UAT Utente standard: ordine + frige WIP', async ({ page }) => {
  await seedCoreOrders(page);
  await seedUserOrders(page);
  await page.goto('/');

  await expect(page.locator('a[href*="pagnottella"], a[href*="fornitor"]')).toHaveCount(0);
  await expect(page.locator('body')).not.toContainText('Scegli il fornitore');
  await expect(page.locator('#menu-view').getByText('Pagamento Alimentari Russo')).toBeVisible();

  await page.click('#btn-menu');
  await page.click('[data-action="add-std"]');

  await page.click('#btn-cart');
  const confirm = page.locator('[data-action="send-order"]');
  await confirm.click();

  await page.click('#btn-menu');
  await expect(page.locator('#btn-frige')).toHaveAttribute('aria-disabled', 'true');
  await expect(page.locator('#frige-wip')).toHaveCount(1);

  await expect(page.locator('#toast')).toBeVisible();
  await expect(page.locator('#daily-summary-inline')).toContainText('Il tuo riepilogo oggi');
});
