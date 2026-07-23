import { test, expect } from '@playwright/test';

const reviewPath = '/pagnottella-preview/?preview=admin&review=sponsor';

test.beforeEach(async ({ page }) => {
  await page.goto(reviewPath);
  await expect(page.locator('#shop')).toHaveClass(/show/);
});

test('catalogo completo, immagini e navigazione autonoma', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Flusso funzionale verificato su desktop');
  await expect(page).toHaveTitle(/Pagnottella Gourmet/);
  await expect(page.locator('.brandLogo')).toBeVisible();
  await expect(page.locator('.suiteInlineLogo')).toBeVisible();
  await expect(page.locator('#grid .card')).toHaveCount(102);
  await expect(page.locator('body')).not.toContainText(/cambia fornitore/i);
  await expect(page.locator('body')).not.toContainText(/documenti locali/i);
  await expect(page.locator('body')).not.toContainText(/layout più vicino alla demo/i);

  await page.locator('#search').fill('Saporito');
  await expect(page.locator('#grid .card')).toHaveCount(1);
  const image = page.locator('#grid .card img').first();
  await expect(image).toHaveAttribute('src', /panini_saporito__panino_saporito\.jpg/);
  await image.scrollIntoViewIfNeeded();
  await image.evaluate((element: HTMLImageElement) => element.decode());
  expect(await image.evaluate((element: HTMLImageElement) => element.naturalWidth)).toBeGreaterThan(0);

  await page.getByRole('button', { name: /torna alla presentazione/i }).click();
  await expect(page.locator('#landing')).not.toHaveClass(/hidden/);
  await expect(page.locator('#shop')).not.toHaveClass(/show/);
  await page.getByRole('button', { name: /apri il catalogo/i }).click();
  await expect(page.locator('#shop')).toHaveClass(/show/);
  await expect(page).toHaveURL(/preview=admin&review=sponsor/);
});

test('carrello, sconto, pagamenti e riepilogo ordine', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Flusso funzionale verificato su desktop');
  await page.locator('#search').fill('Saporito');
  await page.locator('#grid .card .add').click();
  await expect(page.locator('#cartCount')).toHaveText('1');
  await expect(page.locator('#discountLabel')).toContainText('20%');
  await expect(page.locator('#finalTotal')).toContainText('€6,40');

  await expect(page.locator('input[name="paymentMethod"][value="Contanti"]')).toBeChecked();
  await expect(page.locator('input[name="paymentMethod"][value="PayPal"]')).toBeDisabled();
  await expect(page.locator('input[name="paymentMethod"][value="Nexi"]')).toBeDisabled();

  await page.locator('.paymentOption').filter({ hasText: 'Satispay' }).click();
  await expect(page.locator('input[name="paymentMethod"][value="Satispay"]')).toBeChecked();
  await expect(page.locator('#paymentDetails img')).toHaveAttribute('src', /satispay-qr-pagnottella\.png/);

  await page.locator('.paymentOption').filter({ hasText: 'Bonifico bancario' }).click();
  await expect(page.locator('input[name="paymentMethod"][value="Bonifico bancario"]')).toBeChecked();
  await expect(page.locator('#paymentDetails')).toContainText('3M Società a Responsabilità Limitata');
  await expect(page.locator('#paymentDetails')).toContainText('IT35B0832703249000000002986');
  await page.locator('#notes').fill('No cipolla');
  await expect(page.locator('#waPreview')).toContainText('📦 Riepilogo Ordine – La Pagnottella Gourmet');
  await expect(page.locator('#waPreview')).toContainText('Anteprima sponsor – DOS Design S.p.a.');
  await expect(page.locator('#waPreview')).toContainText('Metodo selezionato: Bonifico bancario');
  await expect(page.locator('#waPreview')).toContainText('No cipolla');

  page.once('popup', async popup => popup.close());
  await page.locator('#sendOrderBtn').click();
  await expect(page.locator('#confirm')).toContainText('salvato correttamente');

  const logs = await page.evaluate(() => localStorage.getItem('pg_order_logs') || '');
  expect(logs).not.toContain('IT35B0832703249000000002986');
  expect(logs).not.toContain('3M Società a Responsabilità Limitata');
  expect(logs).not.toContain('No cipolla');
  const orders = await page.evaluate(() => JSON.parse(localStorage.getItem('dose_preview_pagnottella_orders') || '[]'));
  expect(orders).toHaveLength(1);
  expect(orders[0]).toMatchObject({
    supplierId: 'pagnottella',
    supplierName: 'La Pagnottella Gourmet',
    paymentMethod: 'Bonifico bancario',
    total: 6.4,
    preview: true
  });
});

test('layout utilizzabile su viewport mobile', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'Verifica specifica mobile');
  await expect(page.locator('.topbar')).toBeVisible();
  await expect(page.locator('#grid .card').first()).toBeVisible();
  await page.locator('#grid .card .add').first().click();
  await expect(page.locator('#mobileBar')).not.toHaveClass(/hidden/);
  await page.locator('#mobileBar button').click();
  await expect(page.locator('#cart')).toHaveClass(/open/);
  await expect(page.locator('#sendOrderBtn')).toBeVisible();
});
