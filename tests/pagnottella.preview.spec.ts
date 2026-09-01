import { test, expect } from '@playwright/test';
import {
  previewHubUrl,
  previewRussoUrl,
  previewPagnottellaUrl,
  previewPagnottellaFileUrl,
  previewRussoFileUrl
} from './helpers/routes';

test.describe('Preview multi-fornitore', () => {
  test('Hub: espone entrambi i fornitori con link separati', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('dose_e2e', '1');
      window.localStorage.setItem('dose_user', JSON.stringify({
        uid: 'admin-e2e',
        name: 'Marco Tranquilli',
        email: 'marco.tranquilli@dos.design'
      }));
    });
    await page.goto(previewHubUrl);

    await expect(page.getByRole('heading', { name: /accedi a dosepranza/i })).toBeVisible();
    await expect(page.locator('#hub-auth-status')).toContainText('Accesso amministratore completato');
    await expect(page.getByRole('link', { name: /apri alimentari russo/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /apri pagnottella gourmet/i })).toBeVisible();
    await expect(page.locator('#supplier-control-panel')).toBeVisible();
    await expect(page.locator('#pagnottella-enabled')).not.toBeChecked();
    await page.locator('#pagnottella-enabled').check();
    await expect(page.locator('#supplier-control-status')).toContainText('abilitata');
    await expect(page.locator('#pagnottella-visibility-status')).toHaveText('Attiva per gli utenti');
  });

  test('Hub: un utente standard viene instradato direttamente ad Alimentari Russo', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('dose_e2e', '1');
      window.localStorage.setItem('dose_user', JSON.stringify({
        uid: 'user-e2e',
        name: 'Mario Rossi',
        email: 'mario.rossi@dos.design'
      }));
    });
    await page.goto(previewHubUrl);

    await expect(page).toHaveURL(/\/russo\/(?:\?.*)?$/);
  });

  test('Supplier guard: senza sessione rimanda all’hub', async ({ page }) => {
    await page.goto(previewRussoUrl);

    await expect(page).toHaveURL(/\/\?next=russo$/);
    await expect(page.locator('#hub-auth-status')).toContainText('Nessuna sessione Google attiva');
  });

  test('Pagnottella: se non pubblicata, un utente standard viene riportato su Russo', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('dose_e2e', '1');
      window.localStorage.setItem('dose_user', JSON.stringify({
        uid: 'user-e2e',
        name: 'Mario Rossi',
        email: 'mario.rossi@dos.design'
      }));
    });
    await page.goto(previewPagnottellaUrl);

    await expect(page).toHaveURL(/\/russo\/(?:\?.*)?$/);
  });

  test('Hub: con sessione e parametro next apre direttamente il fornitore richiesto', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('dose_e2e', '1');
      window.localStorage.setItem('dose_user', JSON.stringify({
        uid: 'admin-e2e',
        name: 'Marco Tranquilli',
        email: 'marco.tranquilli@dos.design'
      }));
    });
    await page.goto(`${previewHubUrl}?next=pagnottella`);

    await expect(page).toHaveURL(/\/pagnottella\/\?store=pagnottella$/);
    await expect(page.locator('#shop')).toHaveClass(/show/);
  });

  test('Russo: la preview operativa resta accessibile', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('dose_e2e', '1');
      window.localStorage.setItem('dose_user', JSON.stringify({
        uid: 'admin-e2e',
        name: 'Marco Tranquilli',
        email: 'marco.tranquilli@dos.design'
      }));
    });
    await page.goto(previewRussoUrl);

    await expect(page.locator('#btn-menu')).toBeVisible();
    await expect(page.locator('#btn-cart')).toBeVisible();
    await page.locator('#btn-menu').click();
    await expect(page.locator('#menu-view').getByText(/pagamento alimentari russo/i)).toBeVisible();
    await expect(page.getByRole('link', { name: /apri satispay/i })).toHaveAttribute('href', /satispay/i);
  });

  test('Pagnottella: catalogo, sconto, carrello e riepilogo WhatsApp', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('dose_e2e', '1');
      window.localStorage.setItem('dose_user', JSON.stringify({
        uid: 'admin-e2e',
        name: 'Marco Tranquilli',
        email: 'marco.tranquilli@dos.design'
      }));
      window.localStorage.setItem('pg_order_logs', JSON.stringify([{
        id: 'legacy-sensitive-log',
        ts: '2026-07-01T10:00:00.000Z',
        supplierId: 'pagnottella',
        customer: 'Cliente storico',
        company: 'DOS Design S.p.a.',
        costCenter: 'Via Arno, 52, 00198 Roma RM',
        paymentMethod: 'Bonifico bancario',
        count: 1,
        total: 8,
        message: 'IBAN: IT35B0832703249000000002986',
        restaurateurSummary: 'Intestatario: 3M Società a Responsabilità Limitata',
        allergies: 'No noci'
      }]));
    });
    await page.goto(previewPagnottellaUrl);

    const migratedLegacyLogs = await page.evaluate(() => window.localStorage.getItem('pg_order_logs') || '');
    expect(migratedLegacyLogs).not.toContain('IT35B0832703249000000002986');
    expect(migratedLegacyLogs).not.toContain('3M Società a Responsabilità Limitata');
    expect(migratedLegacyLogs).not.toContain('No noci');

    await expect(page.locator('#shop')).toHaveClass(/show/);
    await expect(page.locator('#landing')).toHaveClass(/authResolved/);
    await expect(page.locator('body')).not.toContainText('Un layout più vicino alla demo');
    await expect(page.locator('body')).not.toContainText('volantino del punto vendita');
    await expect(page.locator('body')).not.toContainText('review stakeholder');
    await expect(page.locator('body')).not.toContainText('Admin demo');
    await expect(page.locator('#heroText')).toContainText('12:00');
    await expect(page.locator('#heroText')).toContainText('13:00');
    await expect(page.locator('body')).not.toContainText('Documenti locali');
    await expect(page.locator('body')).not.toContainText('Materiali commerciali');
    await expect(page.locator('body')).not.toContainText('Dati aziendali (opzionale)');
    await expect(page.locator('#customer')).toHaveValue('Marco Tranquilli');
    await expect(page.locator('#paymentCardTitle')).toContainText('Pagamento entro le 12:00');
    await expect(page.locator('#paymentCardText')).toContainText('PayPal e Nexi non sono ancora selezionabili');
    await expect(page.locator('#paymentMethods')).toContainText('Satispay');
    await expect(page.locator('#paymentMethods')).toContainText('Bonifico bancario');
    await expect(page.locator('#paymentMethods')).toContainText('Contanti');
    await expect(page.locator('#paymentMethods')).toContainText('POS');
    await expect(page.locator('input[name="paymentMethod"][value="Contanti"]')).toBeChecked();
    await expect(page.locator('input[name="paymentMethod"][value="PayPal"]')).toBeDisabled();
    await expect(page.locator('input[name="paymentMethod"][value="Nexi"]')).toBeDisabled();
    await expect(page.locator('#paymentDetails')).toContainText('Paga in contanti');
    await expect(page.locator('#paymentDetails')).not.toContainText('IT35B0832703249000000002986');

    await page.locator('#search').fill('BBQ');
    await expect(page.locator('#grid .card')).toHaveCount(1);
    await expect(page.locator('#grid .card').first()).toContainText('BBQ');
    await expect(page.locator('#grid .card').first()).toHaveClass(/imageFallback/);
    await expect(page.locator('#grid .card').first()).toContainText('Foto specifica non disponibile');
    await expect(page.locator('#grid .card img').first()).toHaveAttribute('src', /logo_pagnottella\.webp/);

    await page.locator('#search').fill('Saporito');
    await expect(page.locator('#grid .card')).toHaveCount(1);
    await expect(page.locator('#grid .card img').first()).toHaveAttribute('src', /panini_saporito__panino_saporito\.jpg/);
    await expect(page.locator('#grid .card').first()).not.toHaveClass(/imageFallback/);
    await expect(page.locator('#grid .card').first()).not.toContainText('Foto prodotto');
    await expect(page.locator('#grid .card').first()).not.toContainText('Foto associata');
    await expect(page.locator('#grid .card').first()).not.toContainText('Foto categoria');

    await page.locator('#grid .card .details').first().click();
    await expect(page.locator('#drawer')).toContainText('Saporito');
    await expect(page.locator('#drawer')).not.toContainText('confidenza');
    await expect(page.locator('#drawer')).not.toContainText('Foto prodotto');
    await page.keyboard.press('Escape');
    await expect(page.locator('#drawer')).not.toHaveClass(/show/);

    await page.locator('#grid .card .add').first().click();
    await expect(page.locator('#cartCount')).toHaveText('1');
    await expect(page.locator('#finalTotal')).toContainText('€6,40');
    await expect(page.locator('#discountLabel')).toContainText('20%');

    await page.locator('#notes').fill('No cipolla');
    await expect(page.locator('#waPreview')).toContainText('Ordine tramite DOSepranza');
    await expect(page.locator('#waPreview')).toContainText('👤 Cliente');
    await expect(page.locator('#waPreview')).toContainText('🥪 Ordine');
    await expect(page.locator('#waPreview')).toContainText('Marco Tranquilli – DOS Design S.p.a.');
    await expect(page.locator('#waPreview')).toContainText('Consegna: Via Arno, 52, 00198 Roma RM');
    await expect(page.locator('#waPreview')).not.toContainText('Punto Vendita');
    await expect(page.locator('#waPreview')).not.toContainText('Finestra servizio');
    await expect(page.locator('#waPreview')).toContainText('Metodo selezionato: Contanti');
    await expect(page.locator('#waPreview')).not.toContainText('Note pagamento:');
    await expect(page.locator('#waPreview')).not.toContainText('IBAN: IT35B0832703249000000002986');
    await expect(page.locator('#waPreview')).toContainText('No cipolla');
    await expect(page.locator('#confirm')).toBeHidden();

    await page.locator('input[name="paymentMethod"][value="Satispay"]').check();
    await expect(page.locator('#paymentDetails img')).toHaveAttribute('src', /satispay-qr-pagnottella\.png/);
    await page.locator('input[name="paymentMethod"][value="Bonifico bancario"]').check();
    await expect(page.locator('#waPreview')).toContainText('Metodo selezionato: Bonifico bancario');
    await expect(page.locator('#waPreview')).toContainText('Intestatario: 3M Società a Responsabilità Limitata');
    await expect(page.locator('#waPreview')).toContainText('IBAN: IT35B0832703249000000002986');
    await expect(page.locator('#paymentDetails')).toContainText('IT35B0832703249000000002986');

    page.once('popup', async popup => {
      await popup.close();
    });
    await page.locator('button.whatsappMain').click();
    await expect(page.locator('#confirm')).toContainText('salvato correttamente');
    const savedOrders = await page.evaluate(() => JSON.parse(window.localStorage.getItem('dose_e2e_pagnottella_orders') || '[]'));
    expect(savedOrders).toHaveLength(1);
    expect(savedOrders[0]).toMatchObject({
      supplierId: 'pagnottella',
      supplierName: 'La Pagnottella Gourmet',
      paymentMethod: 'Bonifico bancario',
      company: 'DOS Design S.p.a.',
      deliveryAddress: 'Via Arno, 52, 00198 Roma RM',
      uid: 'admin-e2e'
    });
    expect(savedOrders[0]).not.toHaveProperty('restaurateurSummary');
    expect(savedOrders[0]).not.toHaveProperty('allergies');
    expect(savedOrders[0].hasNotesOrAllergies).toBe(true);

    const localLogs = await page.evaluate(() => JSON.parse(window.localStorage.getItem('pg_order_logs') || '[]'));
    expect(localLogs).toHaveLength(2);
    expect(localLogs[0]).toMatchObject({
      supplierId: 'pagnottella',
      paymentMethod: 'Bonifico bancario',
      count: 1,
      total: 6.4,
      hasNotesOrAllergies: true,
      savedToFirebase: false
    });
    for (const log of localLogs) {
      expect(Object.keys(log).sort()).toEqual([
        'company',
        'costCenter',
        'count',
        'customer',
        'hasNotesOrAllergies',
        'id',
        'paymentMethod',
        'savedToFirebase',
        'supplierId',
        'total',
        'ts'
      ].sort());
    }
    const serializedLogs = JSON.stringify(localLogs);
    expect(serializedLogs).not.toContain('IT35B0832703249000000002986');
    expect(serializedLogs).not.toContain('3M Società a Responsabilità Limitata');
    expect(serializedLogs).not.toContain('No cipolla');
    expect(serializedLogs).not.toContain('No noci');
    expect(serializedLogs).not.toContain('restaurateurSummary');
  });

  test('Pagnottella file://: fallback locale carica senza fetch error', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('dose_user', JSON.stringify({
        uid: 'admin-file',
        name: 'Marco Tranquilli',
        email: 'marco.tranquilli@dos.design'
      }));
    });
    await page.goto(previewPagnottellaFileUrl);

    await expect(page.locator('#shop')).toHaveClass(/show/);
    await expect(page.locator('#sectionTitle')).toContainText('Tutto il menu');
    await expect(page.locator('#grid .card').first()).toBeVisible();
    await expect(page.locator('#paymentMethods')).toContainText('Satispay');
    await expect(page.locator('body')).not.toContainText('Errore caricamento catalogo Pagnottella');
  });

  test('Russo file://: apertura diretta resta disponibile per verifica locale', async ({ page }) => {
    await page.goto(previewRussoFileUrl);

    await expect(page).toHaveURL(/^file:\/\//);
    await expect(page.locator('#btn-menu')).toBeVisible();
    await expect(page.locator('body')).toContainText('DOSepranza');
  });
});
