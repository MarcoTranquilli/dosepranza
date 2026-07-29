import fs from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { coreOrdersFixture, pagnottellaOrderFixture } from './helpers/e2e-fixtures';

const users = {
  admin:{ uid:'admin-e2e', name:'Marco Tranquilli', email:'marco.tranquilli@dos.design' },
  supplier:{ uid:'russo-e2e', name:'Lorenzo Russo', email:'russolorenzo11@gmail.com' },
  tester:{ uid:'tester-e2e', name:'Utente DOS', email:'utente@dos.design' }
};

async function openAs(page:Page, user:typeof users.admin, orders = [...coreOrdersFixture, pagnottellaOrderFixture]) {
  await page.addInitScript(({ user, orders }) => {
    localStorage.setItem('dose_e2e', '1');
    localStorage.setItem('dose_user', JSON.stringify(user));
    localStorage.setItem('dose_e2e_orders_today', JSON.stringify(orders));
  }, { user, orders });
  await page.goto('/russo/?e2e=1');
}

test('supplier Russo vede esclusivamente ordini Russo e nessun controllo admin', async ({ page }) => {
  await openAs(page, users.supplier);
  await page.locator('#btn-history').click();
  await expect(page.locator('#orders-summary-count')).toHaveText('2 ordini · 6 pezzi');
  await expect(page.locator('#all-orders-list')).toContainText('Gabriele Maria Cirulli');
  await expect(page.locator('#all-orders-list')).not.toContainText('La Pagnottella Gourmet');
  await expect(page.locator('#all-orders-list')).not.toContainText('Saporito');
  await expect(page.locator('#history-ops-recon')).toBeHidden();
  await expect(page.locator('#btn-analytics')).toBeHidden();
});

test('Marco vede entrambi i fornitori e mantiene analytics', async ({ page }) => {
  await openAs(page, users.admin);
  await page.locator('#btn-history').click();
  await expect(page.locator('#orders-summary-count')).toHaveText('3 ordini · 7 pezzi');
  await expect(page.locator('#all-orders-list')).toContainText('La Pagnottella Gourmet');
  await expect(page.locator('#history-ops-recon')).toBeVisible();
  await expect(page.locator('#btn-analytics')).toBeVisible();
});

test('tester ordina senza accesso a storico, analytics o export admin', async ({ page }) => {
  await openAs(page, users.tester, []);
  await expect(page.locator('#btn-history')).toBeHidden();
  await expect(page.locator('#btn-analytics')).toBeHidden();
  await expect(page.locator('#admin-export-btn')).toBeHidden();
  await page.locator('#btn-menu').click();
  const productId = await page.locator('[data-action="add-std"]').first().getAttribute('data-id');
  await page.evaluate(id => (window as typeof window & {addStdToCart:(value:string|null)=>void}).addStdToCart(id), productId);
  await page.locator('#btn-cart').click();
  await page.locator('[data-action="send-order"]').click();
  await expect(page.locator('#toast-message')).toHaveText('Inviato!');
  await expect(page.locator('#cart-count')).toHaveText('0');
});

test('suite apre Russo senza nuovo login e torna alla scelta fornitore preservando la sessione', async ({ page }) => {
  await page.addInitScript(user => {
    localStorage.setItem('dose_e2e', '1');
    localStorage.setItem('dose_user', JSON.stringify({...user, provider:'google.com'}));
    localStorage.setItem('dose_e2e_orders_today', '[]');
  }, users.tester);
  await page.goto('/russo/?suite=production&e2e=1');
  await expect(page).toHaveURL(/\/russo\/\?.*suite=production/);
  await expect(page.locator('#user-modal')).toBeHidden();
  await expect(page.locator('#suite-return-bar')).toBeVisible();
  await expect(page.locator('#role-quick-text')).toContainText(users.tester.email);
  await page.getByRole('link', {name:'Cambia fornitore'}).click();
  await expect(page).toHaveURL(/\/pagnottella-gourmet\/\?.*suite=production/);
  const storedEmail = await page.evaluate(() => JSON.parse(localStorage.getItem('dose_user') || 'null')?.email);
  expect(storedEmail).toBe(users.tester.email);
});

test('Russo diretto non mostra il ritorno suite e ignora escalation role da localStorage', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('dose_e2e', '1');
    localStorage.setItem('dose_user', JSON.stringify({
      uid:'external-e2e',
      name:'Marco Tranquilli',
      email:'test@gmail.com',
      role:'admin',
      isAdmin:true,
      provider:'google.com'
    }));
    localStorage.setItem('dose_e2e_orders_today', '[]');
  });
  await page.goto('/russo/?e2e=1');
  await expect(page.locator('#suite-return-bar')).toBeHidden();
  await expect(page.locator('#btn-history')).toBeHidden();
  await expect(page.locator('#btn-analytics')).toBeHidden();
  await expect(page.locator('#admin-export-btn')).toBeHidden();
});

test('sorgente Russo applica supplierId, query segregata e guard fornitore', async () => {
  const app = fs.readFileSync('app.v20260325.js', 'utf8');
  const guard = fs.readFileSync('russo/russo-auth-guard.js', 'utf8');
  const access = fs.readFileSync('supplier-access.js', 'utf8');
  const suite = fs.readFileSync('pagnottella-gourmet/index.html', 'utf8');
  expect(app).toContain('supplierId: "russo"');
  expect(app).toContain('where("supplierId", "==", "russo")');
  expect(app).toContain('if(!isAdmin()) return;');
  expect(app).toContain("state.authzSource !== 'claims' && googleSession");
  expect(app).not.toContain("ROLE_EMAILS.admin.includes(e) || ROLE_NAMES.admin.includes(n)");
  expect(app).toContain('requireSuiteGoogleSession()');
  expect(guard).toContain("canAccessSupplier('russo', session)");
  expect(guard).toContain("params.get('suite') === 'production'");
  expect(guard).not.toContain("params.get('preview') === 'admin'");
  expect(access).toContain('suiteFallbackSession');
  expect(access).toContain('recoverGoogleSession');
  expect(suite).toContain('../russo/?suite=production');
  expect(app).toContain("http://web.satispay.com/app/open/shops/986e3af6-8a54-4c3d-9c23-b741ca0f8cc0");
});
