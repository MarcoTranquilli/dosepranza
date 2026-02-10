import { test, expect } from '@playwright/test';

const roles = {
  user: { name: 'Mario Rossi', email: 'mario.rossi@dos.design' },
  facility: { name: 'Beatrice Binini', email: 'beatrice.binini@dos.design' },
  ristoratore: { name: 'Lorenzo Russo', email: 'lorenzo.russo@alimentarirusso' },
  admin: { name: 'Marco Tranquilli', email: 'marco.tranquilli@dos.design' }
};

async function login(page, name: string, email: string) {
  await page.goto('/');
  const modal = page.locator('#user-modal');
  if (await modal.isVisible()) {
    await page.fill('#user-name-input', name);
    await page.fill('#user-email-input', email);
    await page.click('[data-action="save-user"]');
  }
}

test('UAT Utente standard: ordine + frige', async ({ page }) => {
  await login(page, roles.user.name, roles.user.email);

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

test('UAT Facility: stock + rifornimenti', async ({ page }) => {
  await login(page, roles.facility.name, roles.facility.email);

  await page.click('#btn-frige');
  const add = page.locator('[data-action="frige-adjust-stock"][data-delta="1"]').first();
  await add.click();

  const refill = page.locator('[data-action="frige-request-refill"]').first();
  if (await refill.isVisible()) await refill.click();

  await expect(page.locator('#btn-history')).toBeHidden();
  await expect(page.locator('#btn-analytics')).toBeHidden();
});

test('UAT Ristoratore: gestione frige + riconciliazione', async ({ page }) => {
  await login(page, roles.ristoratore.name, roles.ristoratore.email);

  await page.click('#btn-frige');
  const price = page.locator('[data-action="frige-update-price"]').first();
  if (await price.isVisible()) {
    page.once('dialog', dialog => dialog.dismiss());
    await price.click();
  }

  await page.click('#btn-history');
  await expect(page.locator('#orders-payments-list')).toBeVisible();
});

test('UAT Admin: analytics + export', async ({ page }) => {
  await login(page, roles.admin.name, roles.admin.email);

  await page.click('#btn-analytics');
  await expect(page.locator('#analytics-view')).toBeVisible();

  await page.click('[data-action="analytics-range"][data-range="7d"]');
  await page.click('[data-action="analytics-export-csv"]');

  await page.click('[data-action="analytics-export-pdf"]');
});
