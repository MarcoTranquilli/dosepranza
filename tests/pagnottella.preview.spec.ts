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
      window.localStorage.setItem('dose_user', JSON.stringify({
        name: 'Marco Tranquilli',
        email: 'marco.tranquilli@dos.design'
      }));
    });
    await page.goto(previewHubUrl);

    await expect(page.getByRole('heading', { name: /accedi e scegli il fornitore/i })).toBeVisible();
    await expect(page.locator('#hub-auth-status')).toContainText('Marco Tranquilli');
    await expect(page.getByRole('link', { name: /apri alimentari russo/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /apri pagnottella gourmet/i })).toBeVisible();
  });

  test('Supplier guard: senza sessione rimanda all’hub', async ({ page }) => {
    await page.goto(previewRussoUrl);

    await expect(page).toHaveURL(/\/\?next=russo$/);
    await expect(page.locator('#hub-auth-status')).toContainText('Nessuna sessione Google attiva');
  });

  test('Hub: con sessione e parametro next apre direttamente il fornitore richiesto', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('dose_user', JSON.stringify({
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
      window.localStorage.setItem('dose_user', JSON.stringify({
        name: 'Marco Tranquilli',
        email: 'marco.tranquilli@dos.design'
      }));
    });
    await page.goto(previewRussoUrl);

    await expect(page.locator('#btn-menu')).toBeVisible();
    await expect(page.locator('#btn-cart')).toBeVisible();
    await expect(page.locator('#menu-view').getByText(/pagamento alimentari russo/i)).toBeVisible();
    await expect(page.getByRole('link', { name: /apri satispay/i })).toHaveAttribute('href', /satispay/i);
  });

  test('Pagnottella: catalogo, sconto, carrello e riepilogo WhatsApp', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('dose_user', JSON.stringify({
        name: 'Marco Tranquilli',
        email: 'marco.tranquilli@dos.design'
      }));
    });
    await page.goto(previewPagnottellaUrl);

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
    await expect(page.locator('#paymentMethods')).toContainText('Satispay');
    await expect(page.locator('#paymentMethods')).toContainText('Bonifico istantaneo');
    const paymentLinks = page.locator('#paymentMethods a');
    if (await paymentLinks.count()) {
      await expect(paymentLinks.nth(0)).toHaveAttribute('href', /satispay|placeholder/);
      await expect(paymentLinks.nth(1)).toHaveAttribute('href', /bonifico|placeholder/);
    }

    await page.locator('#search').fill('BBQ');
    await expect(page.locator('#grid .card')).toHaveCount(1);
    await expect(page.locator('#grid .card').first()).toContainText('BBQ');

    await page.locator('#search').fill('Saporito');
    await expect(page.locator('#grid .card')).toHaveCount(1);
    await expect(page.locator('#grid .card img').first()).toHaveAttribute('src', /panini_saporito__panino_saporito\.jpg/);
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
    await expect(page.locator('#waPreview')).toContainText('Azienda: DOS Design S.p.a.');
    await expect(page.locator('#waPreview')).toContainText('Sede di consegna: Via Arno, 52, 00198 Roma RM');
    await expect(page.locator('#waPreview')).toContainText('Pagamento anticipato entro le 12:00');
    await expect(page.locator('#waPreview')).toContainText('Satispay, Bonifico istantaneo');
    await expect(page.locator('#waPreview')).toContainText('No cipolla');
    await expect(page.locator('#confirm')).toBeHidden();

    page.once('popup', async popup => {
      await popup.close();
    });
    await page.locator('button.whatsappMain').click();
    await expect(page.locator('#confirm')).toContainText('pagamento entro le 12:00');
  });

  test('Pagnottella file://: fallback locale carica senza fetch error', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('dose_user', JSON.stringify({
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
