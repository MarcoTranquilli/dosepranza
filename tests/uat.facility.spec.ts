import { test, expect } from '@playwright/test';

test('UAT Facility: stock + rifornimenti', async ({ page }) => {
  await page.goto('/');

  await page.click('#btn-frige');
  await page.waitForTimeout(500);
  const add = page.locator('[data-action="frige-adjust-stock"][data-delta="1"]').first();
  if (await add.count()) await add.click();

  const refill = page.locator('[data-action="frige-request-refill"]').first();
  if (await refill.isVisible()) await refill.click();

  await expect(page.locator('#btn-history')).toBeHidden();
  await expect(page.locator('#btn-analytics')).toBeHidden();
});
