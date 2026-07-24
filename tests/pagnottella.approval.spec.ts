import { test, expect } from '@playwright/test';

const reviewPath = 'pagnottella-preview/?preview=admin&review=sponsor';

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
  await expect(page.locator('#extras-preview-title')).toHaveText('72 ingredienti disponibili');
  await expect(page.locator('#extrasGrid .extraChip')).toHaveCount(72);
  await expect(page.locator('#extrasGrid')).toContainText('Funghi');
  await expect(page.locator('#extrasGrid')).toContainText('Salsa al tartufo');
  await expect(page.locator('#extrasGrid')).toContainText('Semi di sesamo');
  await expect(page.locator('#price-validity-note')).toContainText('30/08/2026');
  await expect(page.locator('#service-closure-notice')).toContainText('17 agosto');
  await expect(page.locator('#service-closure-notice')).toContainText('23 agosto 2026');
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

test('foto ufficiali del fornitore associate ai prodotti corretti', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Verifica immagini eseguita su desktop');
  for (const [product, filename] of [
    ['Brontolo', 'panini_brontolo__panino_brontolo.jpg'],
    ['Newyorkese', 'panini_newyorkese__panino_newyorkese.jpg'],
    ['Reginella', 'insalate_reginella__insalata_reginella.jpg'],
    ['Salentina', 'insalate_salentina__insalata_salentina.jpg']
  ]) {
    await page.locator('#search').fill(product);
    const card = page.locator('#grid .card').filter({ hasText: product }).first();
    await expect(card).toBeVisible();
    await expect(card).not.toHaveClass(/imageFallback/);
    const image = card.locator('img');
    await expect(image).toHaveAttribute('src', new RegExp(filename.replace('.', '\\.')));
    await image.scrollIntoViewIfNeeded();
    await image.evaluate((element: HTMLImageElement) => element.decode());
    expect(await image.evaluate((element: HTMLImageElement) => element.naturalWidth)).toBeGreaterThan(0);
  }
});

test('promo estesa e chiusura applicate come regole operative', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Verifica temporale eseguita su desktop');

  await page.addInitScript(() => {
    (window as Window & { __PAGNOTTELLA_NOW__?: string }).__PAGNOTTELLA_NOW__ = '2026-08-24T10:00:00+02:00';
  });
  await page.reload();
  await expect(page.locator('#shop')).toHaveClass(/show/);
  await page.locator('#search').fill('Saporito');
  await page.locator('#grid .card .add').click();
  await expect(page.locator('#discountLabel')).toContainText('20%');
  await expect(page.locator('#finalTotal')).toContainText('€6,40');

  await page.addInitScript(() => {
    (window as Window & { __PAGNOTTELLA_NOW__?: string }).__PAGNOTTELLA_NOW__ = '2026-08-20T10:00:00+02:00';
  });
  await page.reload();
  await expect(page.locator('#service-closure-notice')).toHaveClass(/isActive/);
  await expect(page.locator('#sectionSub')).toContainText('ordini temporaneamente sospesi');
  await expect(page.locator('#grid .card .add').first()).toBeDisabled();
  await expect(page.locator('#grid .card .add').first()).toHaveText('Chiuso');
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
