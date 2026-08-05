import fs from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { coreOrdersFixture, pagnottellaOrderFixture } from './helpers/e2e-fixtures';

const users = {
  admin:{ uid:'admin-e2e', name:'Marco Tranquilli', email:'marco.tranquilli@dos.design' },
  supplier:{ uid:'russo-e2e', name:'Lorenzo Russo', email:'russolorenzo11@gmail.com' },
  dos_user:{ uid:'dos_user-e2e', name:'Utente DOS', email:'utente@dos.design' }
};

async function openAs(page:Page, user:typeof users.admin, orders = [...coreOrdersFixture, pagnottellaOrderFixture]) {
  await page.addInitScript(({ user, orders }) => {
    localStorage.setItem('dose_e2e', '1');
    localStorage.setItem('dose_user', JSON.stringify(user));
    localStorage.setItem('dose_e2e_orders_today', JSON.stringify(orders));
  }, { user, orders });
  await page.goto('/russo/?e2e=1', {waitUntil:'domcontentloaded'});
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

test('Marco nel pannello Russo vede solo Russo e mantiene analytics segregate', async ({ page }) => {
  await openAs(page, users.admin);
  await page.locator('#btn-history').click();
  await expect(page.locator('#orders-summary-count')).toHaveText('2 ordini · 6 pezzi');
  await expect(page.locator('#all-orders-list')).not.toContainText('La Pagnottella Gourmet');
  await expect(page.locator('#all-orders-list')).not.toContainText('Saporito');
  await expect(page.locator('#history-ops-recon')).toBeVisible();
  await expect(page.locator('#btn-analytics')).toBeVisible();
});

test('listener realtime Russo ignora Pagnottella, legacy e pulisce lo stato al cambio account', async ({ page }) => {
  await openAs(page, users.supplier);
  await page.locator('#btn-history').click();
  const legacy = {...coreOrdersFixture[0], id:'legacy-russo', supplierId:undefined, user:'Legacy Russo'};
  const newPagnottella = {...pagnottellaOrderFixture, id:'pg-realtime', user:'Pagnottella Realtime'};
  await page.evaluate(({orders, legacy, newPagnottella}) => {
    const target = window as typeof window & {__DOSE_E2E_APPLY_ORDERS__?:(orders:unknown[])=>void};
    target.__DOSE_E2E_APPLY_ORDERS__?.([...orders, legacy, newPagnottella]);
  }, {orders:coreOrdersFixture, legacy, newPagnottella});
  await expect(page.locator('#orders-summary-count')).toHaveText('2 ordini · 6 pezzi');
  await expect(page.locator('#all-orders-list')).not.toContainText('Pagnottella Realtime');
  await expect(page.locator('#all-orders-list')).not.toContainText('Legacy Russo');

  const newRusso = {...coreOrdersFixture[0], id:'russo-realtime', user:'Russo Realtime'};
  await page.evaluate(({orders, newRusso}) => {
    const target = window as typeof window & {__DOSE_E2E_APPLY_ORDERS__?:(orders:unknown[])=>void};
    target.__DOSE_E2E_APPLY_ORDERS__?.([...orders, newRusso]);
  }, {orders:coreOrdersFixture, newRusso});
  await expect(page.locator('#all-orders-list')).toContainText('Russo Realtime');

  await page.evaluate(() => {
    const target = window as typeof window & {__DOSE_E2E_RESET_STAFF__?:()=>void};
    target.__DOSE_E2E_RESET_STAFF__?.();
  });
  await expect(page.locator('#all-orders-list')).not.toContainText('Russo Realtime');
});

test('Marco resta admin entrando in Russo dalla suite', async ({ page }) => {
  await page.addInitScript(user => {
    localStorage.setItem('dose_e2e', '1');
    localStorage.setItem('dose_user', JSON.stringify({...user, role:'user', provider:'google.com'}));
    localStorage.setItem('dose_e2e_orders_today', '[]');
  }, users.admin);
  await page.goto('/russo/?suite=production&e2e=1', {waitUntil:'domcontentloaded'});
  await expect(page.locator('#role-quick-text')).toContainText('Amministratore');
  await expect(page.locator('#btn-history')).toBeVisible();
  await expect(page.locator('#btn-analytics')).toBeVisible();
});

test('utente DOS ordina senza accesso a storico, analytics o export admin', async ({ page }) => {
  await openAs(page, users.dos_user, []);
  await expect(page.locator('#btn-history')).toBeHidden();
  await expect(page.locator('#btn-analytics')).toBeHidden();
  await expect(page.locator('#admin-export-btn')).toBeHidden();
  await page.locator('#btn-menu').click();
  const addButton = page.locator('[data-action="add-std"]:not([disabled])').first();
  await expect(addButton).toBeVisible();
  const productId = await addButton.getAttribute('data-id');
  await page.evaluate(id => (window as typeof window & {addStdToCart:(value:string|null)=>void}).addStdToCart(id), productId);
  await expect(page.locator('#cart-count')).toHaveText('1');
  await page.locator('#btn-cart').click();
  await expect(page.locator('#cart-options')).toBeVisible();
  await page.locator('[data-action="send-order"]').click();
  await expect(page.locator('#toast-message')).toHaveText('Inviato!');
  await expect(page.locator('#cart-count')).toHaveText('0');
});

async function prepareRussoOrderSave(page:Page, mode:'success'|'failure'|'delayed') {
  await page.addInitScript(({user, mode}) => {
    localStorage.setItem('dose_e2e', '1');
    localStorage.setItem('dose_user', JSON.stringify(user));
    localStorage.setItem('dose_e2e_orders_today', '[]');
    (window as typeof window & {__russoSaveCalls?:number; __DOSE_E2E_SAVE_ORDER__?:(payload:unknown)=>Promise<{id:string}>}).__russoSaveCalls = 0;
    (window as typeof window & {__russoSaveCalls?:number; __DOSE_E2E_SAVE_ORDER__?:(payload:unknown)=>Promise<{id:string}>}).__DOSE_E2E_SAVE_ORDER__ = async payload => {
      const target = window as typeof window & {__russoSaveCalls?:number};
      target.__russoSaveCalls = (target.__russoSaveCalls || 0) + 1;
      if(mode === 'failure') throw Object.assign(new Error('simulated'), {code:'permission-denied'});
      if(mode === 'delayed') await new Promise(resolve => setTimeout(resolve, 150));
      if((payload as {supplierId?:string}).supplierId !== undefined) throw new Error('supplierId belongs to persisted document');
      return {id:'russo-e2e-order'};
    };
  }, {user:users.dos_user, mode});
  await page.goto('/russo/?e2e=1', {waitUntil:'domcontentloaded'});
  await page.locator('#btn-menu').click();
  const addButton = page.locator('[data-action="add-std"]:not([disabled])').first();
  const productId = await addButton.getAttribute('data-id');
  await page.evaluate(id => (window as typeof window & {addStdToCart:(value:string|null)=>void}).addStdToCart(id), productId);
  await page.locator('#btn-cart').click();
  await page.locator('[data-action="send-order"]').click();
  await expect(page.locator('#order-send-modal')).toBeVisible();
  await page.locator('#order-send-check').check();
}

test('salvataggio Russo conferma una sola scrittura e mostra successo', async ({page}) => {
  await prepareRussoOrderSave(page, 'delayed');
  const submit = page.locator('#order-send-submit');
  await submit.dblclick({delay:10});
  await expect(page.locator('#order-confirm-modal')).toBeVisible();
  await expect.poll(() => page.evaluate(() => (window as typeof window & {__russoSaveCalls?:number}).__russoSaveCalls)).toBe(1);
  await expect(page.locator('#cart-count')).toHaveText('0');
});

test('errore salvataggio Russo conserva carrello e consente retry', async ({page}) => {
  await prepareRussoOrderSave(page, 'failure');
  await page.locator('#order-send-submit').click();
  await expect(page.locator('#order-send-error')).toContainText('Il carrello è intatto');
  await expect(page.locator('#cart-count')).toHaveText('1');
  await expect(page.locator('#order-send-submit')).toBeEnabled();
});

test('suite apre Russo senza nuovo login e torna alla scelta fornitore preservando la sessione', async ({ page }) => {
  await page.addInitScript(user => {
    localStorage.setItem('dose_e2e', '1');
    localStorage.setItem('dose_user', JSON.stringify({...user, provider:'google.com'}));
    localStorage.setItem('dose_e2e_orders_today', '[]');
  }, users.dos_user);
  await page.goto('/russo/?suite=production&e2e=1', {waitUntil:'domcontentloaded'});
  await expect(page).toHaveURL(/\/russo\/\?.*suite=production/);
  await expect(page.locator('#user-modal')).toBeHidden();
  await expect(page.locator('#suite-return-bar')).toBeVisible();
  await expect(page.locator('#role-quick-text')).toContainText(`${users.dos_user.email} · Utente DOS`);
  await page.route('**/dosepranza/pagnottella-gourmet/**', route => route.fulfill({
    status:200,
    contentType:'text/html',
    body:'<!doctype html><title>Suite DOSepranza</title>'
  }));
  await page.getByRole('link', {name:'Cambia fornitore'}).click();
  await expect(page).toHaveURL(/\/dosepranza\/pagnottella-gourmet\/\?.*suite=production/);
  const storedEmail = await page.evaluate(() => JSON.parse(localStorage.getItem('dose_user') || 'null')?.email);
  expect(storedEmail).toBe(users.dos_user.email);
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
  await page.goto('/russo/?e2e=1', {waitUntil:'domcontentloaded'});
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
  expect(app).toContain("supplierId: 'russo'");
  expect(app).toContain('where("supplierId", "==", "russo")');
  expect(app).not.toContain('query(ordersCol, orderBy("createdAt", "desc"))');
  expect(app).toContain('if(!isAdmin()) return;');
  expect(app).toContain("state.authzSource !== 'claims' && googleSession");
  expect(app).not.toContain("ROLE_EMAILS.admin.includes(e) || ROLE_NAMES.admin.includes(n)");
  expect(app).toContain('requireSuiteGoogleSession()');
  expect(app).toContain('if(!state.pendingOrder || state.orderSubmitting) return;');
  expect(app).toContain('state.orderSubmitting = true;');
  expect(app).toContain('resolveOrderAuthUser');
  expect(app).toContain('auth/session-missing');
  expect(app).toContain('Il carrello è intatto');
  expect(guard).toContain("canAccessSupplier('russo', session)");
  expect(guard).toContain("params.get('suite') === 'production'");
  expect(guard).toContain("'/dosepranza/pagnottella-gourmet/?suite=production&v=suite-return-2'");
  expect(guard).not.toContain("params.get('preview') === 'admin'");
  expect(access).toContain('suiteFallbackSession');
  expect(access).toContain('recoverGoogleSession');
  expect(suite).toContain('../russo/?suite=production');
  expect(app).toContain("https://web.satispay.com/app/open/shops/986e3af6-8a54-4c3d-9c23-b741ca0f8cc0");
  expect(app).not.toContain("http://web.satispay.com/");
});

test('QR e azioni Satispay Russo usano esclusivamente il link HTTPS canonico', async ({ page }) => {
  await openAs(page, users.dos_user, []);
  const canonicalUrl = 'https://web.satispay.com/app/open/shops/986e3af6-8a54-4c3d-9c23-b741ca0f8cc0';
  const qr = page.locator('img[alt="QR pagamento Alimentari Russo"]').first();
  await expect(qr).toBeVisible();
  await expect(qr).toHaveAttribute('src', `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(canonicalUrl)}`);
  await expect(page.getByRole('link', {name:'Apri Satispay'}).first()).toHaveAttribute('href', canonicalUrl);
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable:true,
      value:{ writeText:(text:string) => {
        (window as typeof window & {__copiedSatispay?:string}).__copiedSatispay = text;
        return Promise.resolve();
      }}
    });
  });
  await page.locator('[data-action="copy-satispay-link"]').first().click();
  await expect.poll(() => page.evaluate(() => (window as typeof window & {__copiedSatispay?:string}).__copiedSatispay)).toBe(canonicalUrl);
});
