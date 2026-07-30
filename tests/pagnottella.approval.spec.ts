import { test, expect, Page } from '@playwright/test';

const reviewPath = 'pagnottella-preview/?preview=admin&review=sponsor&localPreview=1&e2e=1&swreset=1';

async function addProduct(page: Page, name: string, optionIndex = 0, extras: string[] = []) {
  await page.locator('#search').fill(name);
  await page.locator('#grid .card').filter({ hasText:name }).first().locator('.add').click();
  await expect(page.locator('#drawer')).toHaveClass(/show/);
  await page.locator('#options .opt').nth(optionIndex).click();
  for(const extra of extras) {
    await page.locator('#extraSearch').fill(extra);
    await page.locator('#drawerExtras .drawerExtra').filter({ hasText:extra }).click();
  }
  await page.getByRole('button', { name:'Aggiungi al carrello' }).click();
}

async function closeProductDrawer(page: Page) {
  await page.locator('#drawer .close').click();
  await expect(page.locator('#drawer')).not.toHaveClass(/show/);
}

async function confirmOrder(page: Page) {
  const modal = page.locator('#paymentConfirmModal');
  if(!(await modal.getAttribute('class'))?.includes('show')) {
    await page.locator('#sendOrderBtn').click();
  }
  await expect(modal).toHaveClass(/show/);
  const popupPromise = page.waitForEvent('popup');
  await page.locator('#paymentConfirmAccept').click();
  const popup = await popupPromise;
  await expect(page.locator('#confirm')).toContainText('Pagamento dichiarato effettuato');
  await popup.close();
}

test.beforeEach(async ({ page }) => {
  await page.goto(reviewPath);
  await expect(page.locator('#supplierStage')).not.toHaveClass(/hidden/);
  await page.locator('.pagnottellaCard').click();
  await expect(page.locator('#shop')).toHaveClass(/show/);
});

test('gate Google non viene bypassato e file preview usa fallback esplicito', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Scenario desktop');
  await page.goto('/');
  await expect(page).not.toHaveURL(/(?:\\?|&)swreset=1(?:&|$)/);
  await expect(page.locator('#recognitionStage')).not.toHaveClass(/hidden/);
  await expect(page.locator('#supplierStage')).toHaveClass(/hidden/);
  await page.waitForTimeout(700);
  await expect(page.locator('#authGateStatus')).toHaveText('Nessun utente riconosciuto');
  await expect(page.locator('#authGateGoogle')).toHaveText('Accedi con Google');
  await expect(page.locator('#authGateLocal')).toBeVisible();
  await expect(page.locator('#authGateEnvironment')).toHaveText(
    'Usa il tuo account Google @dos.design per accedere alla preview.'
  );
  expect(await page.evaluate(() => localStorage.getItem('dose_user'))).toBeNull();
  expect(await page.evaluate(() => ({
    admin: window.DoseSupplierAccess.roleForEmail('marco.tranquilli@dos.design'),
    supplier: window.DoseSupplierAccess.roleForEmail('commerciale@lapagnottellagourmet.it'),
    dos_user: window.DoseSupplierAccess.roleForEmail('  PERSONA@DOS.DESIGN  '),
    veronica: window.DoseSupplierAccess.roleForEmail('veronica.battaglia@dos.design'),
    marta: window.DoseSupplierAccess.roleForEmail('marta.diamantini@dos.design'),
    andreaValerio: window.DoseSupplierAccess.roleForEmail('andreavalerio.chentrens@dos.design'),
    luca: window.DoseSupplierAccess.roleForEmail('luca.pacella@dos.design'),
    external: window.DoseSupplierAccess.roleForEmail('test@gmail.com'),
    similarSuffix: window.DoseSupplierAccess.roleForEmail('utente@dos.design.fake'),
    similarDomain: window.DoseSupplierAccess.roleForEmail('utente@mydos.design')
  }))).toEqual({
    admin:'admin',
    supplier:'supplier',
    dos_user:'dos_user',
    veronica:'dos_user',
    marta:'dos_user',
    andreaValerio:'dos_user',
    luca:'dos_user',
    external:'user',
    similarSuffix:'user',
    similarDomain:'user'
  });
  expect(await page.evaluate(() => ({
    strictCurrentUser: window.DoseSupplierAccess.isVerifiedGoogleResult([], ''),
    googleProvider: window.DoseSupplierAccess.isVerifiedGoogleResult([{ providerId:'google.com' }], '')
  }))).toEqual({
    strictCurrentUser:false,
    googleProvider:true
  });
  expect(await page.evaluate(async () => ({
    dos_user: await window.DoseSupplierAccess.canAccessSupplier('pagnottella', {
      email:'persona@dos.design', role:'dos_user', isAdmin:false, supplierIds:['pagnottella']
    }),
    external: await window.DoseSupplierAccess.canAccessSupplier('pagnottella', {
      email:'test@gmail.com', role:'user', isAdmin:false, supplierIds:[]
    }),
    similarSuffix: await window.DoseSupplierAccess.canAccessSupplier('pagnottella', {
      email:'utente@dos.design.fake', role:'user', isAdmin:false, supplierIds:[]
    }),
    similarDomain: await window.DoseSupplierAccess.canAccessSupplier('pagnottella', {
      email:'utente@mydos.design', role:'user', isAdmin:false, supplierIds:[]
    })
  }))).toEqual({ dos_user:true, external:false, similarSuffix:false, similarDomain:false });

  const localUrl = `file://${process.cwd()}/pagnottella-preview/index.html?preview=admin&review=sponsor&swreset=1`;
  await page.goto(localUrl);
  await expect(page.locator('#recognitionStage')).not.toHaveClass(/hidden/);
  await expect(page.locator('#supplierStage')).toHaveClass(/hidden/);
  await expect(page.locator('#authGateStatus')).toContainText('Google Login richiede un indirizzo http o https');
  await page.getByRole('button', { name:'Apri anteprima locale' }).click();
  await expect(page.locator('#supplierStage')).not.toHaveClass(/hidden/);
  await expect(page.locator('#recognizedUserDisplay')).toHaveText('Utente DOS · utente.preview@dos.design · Utente DOS');
  await expect(page.locator('.russoCard')).toHaveAttribute('href', '../russo/?suite=approval&v=suite-1');
  await expect(page.locator('.russoCard')).toContainText('con consegna gratuita');
  await expect(page.locator('.russoCard')).toContainText('entro le 11:30');
  await expect(page.locator('.pagnottellaCard')).toContainText('Pagamento entro le 12:00');
  await page.locator('.pagnottellaCard').click();
  await expect(page.locator('#shop')).toHaveClass(/show/);
  await page.getByRole('button', { name:'Cambia fornitore' }).click();
  await page.getByRole('button', { name:'Cambia utente' }).click();
  await expect(page.locator('#recognitionStage')).not.toHaveClass(/hidden/);

  await page.goto('pagnottella-preview/?preview=supplier&review=sponsor&localPreview=1&e2e=1&swreset=1');
  await expect(page.locator('#recognizedUserDisplay')).toHaveText(
    'Commerciale Pagnottella Gourmet · commerciale@lapagnottellagourmet.it · Ristoratore / Fornitore'
  );
  await expect(page.locator('.russoCard')).not.toHaveAttribute('href');
  await expect(page.locator('.russoCard')).toHaveAttribute('aria-disabled', 'true');
});

test('sessione suite condivisa apre Russo senza seconda autenticazione', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Scenario desktop');
  await page.evaluate(() => {
    localStorage.setItem('dose_e2e', '1');
    localStorage.setItem('dose_user', JSON.stringify({
      uid:'admin-suite-e2e',
      name:'Marco Tranquilli',
      email:'marco.tranquilli@dos.design',
      role:'user',
      isAdmin:false,
      supplierIds:[],
      provider:'google.com'
    }));
  });
  await page.goto('russo/?suite=approval&e2e=1');
  await expect(page.locator('#btn-menu')).toBeVisible();
  await expect(page.locator('#user-modal')).toHaveClass(/hidden/);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('dose_user') || 'null'))).toMatchObject({
    email:'marco.tranquilli@dos.design',
    role:'admin',
    isAdmin:true,
    supplierIds:['russo', 'pagnottella'],
    provider:'google.com'
  });
  await page.evaluate(() => window.signOutUser());
  await expect(page.locator('#user-modal')).not.toHaveClass(/hidden/);
  expect(await page.evaluate(() => localStorage.getItem('dose_user'))).toBeNull();
});

test('ruoli supplier e sessioni stale vengono normalizzati dalla suite', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Scenario desktop');
  await page.goto('/');
  const result = await page.evaluate(async () => {
    localStorage.setItem('dose_e2e', '1');
    const access = window.DoseSupplierAccess;
    const resolve = (email) => {
      localStorage.setItem('dose_user', JSON.stringify({
        name:'Utente Test',
        email,
        provider:'google.com'
      }));
      return access.getStoredUser();
    };
    const marco = resolve('  MARCO.TRANQUILLI@DOS.DESIGN ');
    const dos_user = resolve(' COLLEGA@DOS.DESIGN ');
    localStorage.setItem('dose_user', JSON.stringify({
      name:'Sessione precedente',
      email:'marta.diamantini@dos.design',
      role:['te', 'ster'].join(''),
      provider:'google.com'
    }));
    const migratedDosUser = access.getStoredUser();
    const pagnottellaSupplier = resolve('commerciale@lapagnottellagourmet.it');
    const russoSupplier = resolve('russolorenzo11@gmail.com');
    return {
      marco,
      dos_user,
      migratedDosUser,
      pagnottellaSupplier,
      russoSupplier,
      access: {
        pagnottellaToRusso: await access.canAccessSupplier('russo', pagnottellaSupplier),
        pagnottellaToPagnottella: await access.canAccessSupplier('pagnottella', pagnottellaSupplier),
        russoToRusso: await access.canAccessSupplier('russo', russoSupplier),
        russoToPagnottella: await access.canAccessSupplier('pagnottella', russoSupplier)
      }
    };
  });
  expect(result.marco).toMatchObject({ role:'admin', isAdmin:true, supplierIds:['russo', 'pagnottella'] });
  expect(result.dos_user).toMatchObject({ email:'collega@dos.design', role:'dos_user', isAdmin:false, supplierIds:['russo', 'pagnottella'] });
  expect(result.migratedDosUser).toMatchObject({ email:'marta.diamantini@dos.design', role:'dos_user', isAdmin:false, supplierIds:['russo', 'pagnottella'] });
  expect(result.pagnottellaSupplier).toMatchObject({ role:'supplier', supplierIds:['pagnottella'] });
  expect(result.russoSupplier).toMatchObject({ role:'supplier', supplierIds:['russo'] });
  expect(result.access).toEqual({
    pagnottellaToRusso:false,
    pagnottellaToPagnottella:true,
    russoToRusso:true,
    russoToPagnottella:false
  });
});

test('il pulsante Google avvia Firebase Auth su HTTP', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Scenario desktop');
  await page.goto('pagnottella-preview/?preview=admin&review=sponsor&swreset=1');
  const popupPromise = page.waitForEvent('popup');
  await page.getByRole('button', { name:'Accedi con Google' }).click();
  const popup = await popupPromise;
  await expect.poll(() => popup.url()).toMatch(/google\.com|firebaseapp\.com/);
  await popup.close();
});

test('catalogo completo, immagini, orari e amministratore locale', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Scenario desktop');
  await expect(page).toHaveTitle(/Pagnottella Gourmet/);
  await expect(page.locator('.brandLogo')).toBeVisible();
  await expect(page.locator('#grid .card')).toHaveCount(102);
  await expect(page.locator('#extrasGrid .extraChip')).toHaveCount(72);
  await expect(page.locator('#heroTitle')).toHaveText(
    'Panini e insalate gourmet, con sconto estivo e consegna gratuita in pausa pranzo.'
  );
  await expect(page.locator('#cartDeliveryText')).toContainText('12:00');
  await expect(page.locator('#cartDeliveryText')).toContainText('12:30');
  await expect(page.locator('body')).not.toContainText('entro le 13:00');
  await expect(page.locator('#waPreview')).toHaveCount(0);
  await expect(page.locator('#adminWorkspace')).not.toHaveClass(/hidden/);
  await expect(page.locator('#adminIdentity')).toHaveText('marco.tranquilli@dos.design · admin');
  await expect(page.locator('#adminWorkspace')).toContainText(
    'Accesso avanzato attivo: puoi gestire prodotti, ordini e disponibilità.'
  );
  await expect(page.locator('.adminNav')).toContainText('Tutti gli ordini');
  await expect(page.locator('.adminNav')).toContainText('Analisi');
  await expect(page.locator('.adminNav')).toContainText('Gestione menù');
  await expect(page.locator('.adminNav')).toContainText('Export');
  await expect(page.locator('[data-cat="speciali"]')).toHaveText('Specialità');
  await expect(page.locator('[data-cat="bevande"]')).toHaveText('Bevande');
  await expect(page.locator('[data-cat="succhi"]')).toHaveCount(0);
  await expect(page.locator('body')).not.toContainText('Speciali del punto vendita');
  await expect(page.locator('body')).not.toContainText('Succhi freschi');
});

test('foto ufficiali del fornitore associate ai prodotti corretti', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Scenario desktop');
  for (const [product, filename] of [
    ['Brontolo', 'panini_brontolo__panino_brontolo.jpg'],
    ['Newyorkese', 'panini_newyorkese__panino_newyorkese.jpg'],
    ['Reginella', 'insalate_reginella__insalata_reginella.jpg'],
    ['Salentina', 'insalate_salentina__insalata_salentina.jpg']
  ]) {
    await page.locator('#search').fill(product);
    const card = page.locator('#grid .card').filter({ hasText:product }).first();
    const image = card.locator('img');
    await expect(image).toHaveAttribute('src', new RegExp(filename.replace('.', '\\.')));
    await image.evaluate((element: HTMLImageElement) => element.decode());
    expect(await image.evaluate((element: HTMLImageElement) => element.naturalWidth)).toBeGreaterThan(0);
  }
});

test('filtri avanzati applicabili e resettabili', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Scenario desktop');
  await expect(page.locator('#grid .card')).toHaveCount(102);
  await page.locator('[data-cat="panini"]').click();
  await page.locator('[data-diet="vegetariana"]').click();
  const filteredCount = await page.locator('#grid .card').count();
  expect(filteredCount).toBeGreaterThan(0);
  expect(filteredCount).toBeLessThan(55);
  await expect(page.locator('#activeFilterCount')).toHaveText('2');
  await expect(page.locator('#resultCount')).toHaveText(`${filteredCount} prodotti trovati`);
  await page.locator('#search').fill('burrata');
  const searchedCount = await page.locator('#grid .card').count();
  expect(searchedCount).toBeGreaterThan(0);
  expect(searchedCount).toBeLessThanOrEqual(filteredCount);
  await page.locator('.visibleFilterReset').click();
  await page.locator('#search').fill('');
  await expect(page.locator('#grid .card')).toHaveCount(102);
  await expect(page.locator('#activeFilterCount')).toHaveClass(/hidden/);
});

test('tassonomia completa e combinazioni cluster-regime coerenti', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Scenario desktop');
  const taxonomy = await page.evaluate(() => {
    const menu = (window as Window & { __PAGNOTTELLA_MENU__?: { products?: Array<Record<string, unknown>> } }).__PAGNOTTELLA_MENU__;
    const products = menu?.products || [];
    return {
      total: products.length,
      missing: products.filter(product => !product.categoryGroup || !product.dietType).length,
      reviews: products.filter(product => product.needsDietReview === true).length,
      beverages: products.filter(product => product.categoryGroup === 'bevande').length,
      invalidExtras: products.filter(product => product.supportsExtras !== ['panini', 'insalate'].includes(String(product.categoryGroup))).length
    };
  });
  expect(taxonomy).toEqual({ total:102, missing:0, reviews:4, beverages:11, invalidExtras:0 });

  for(const [cluster, diet] of [
    ['all', 'vegana'],
    ['panini', 'pescetariana'],
    ['insalate', 'onnivora'],
    ['dolci', 'vegetariana']
  ]) {
    await page.locator(`[data-cat="${cluster}"]`).click();
    await page.locator(`[data-diet="${diet}"]`).click();
    const count = await page.locator('#grid .card').count();
    expect(count, `${cluster} + ${diet}`).toBeGreaterThan(0);
    await expect(page.locator('#resultCount')).toHaveText(`${count} prodotti trovati`);
  }
});

test('profilo fornitore Pagnottella limitato al catalogo e agli ordini demo', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Scenario desktop');
  await page.goto('pagnottella-preview/?preview=supplier&review=sponsor&localPreview=1&e2e=1&swreset=1');
  await expect(page.locator('#recognizedUserDisplay')).toContainText('commerciale@lapagnottellagourmet.it · Ristoratore / Fornitore');
  await page.locator('.pagnottellaCard').click();
  await expect(page.locator('#shop')).toHaveClass(/show/);
  await expect(page.locator('#adminWorkspace')).not.toHaveClass(/hidden/);
  await expect(page.locator('#adminIdentity')).toHaveText('commerciale@lapagnottellagourmet.it · fornitore');
  await expect(page.locator('#adminAccessCopy')).toContainText('consultare gli ordini demo');
  await expect(page.locator('[data-admin-view="analytics"]')).toHaveClass(/hidden/);
  await expect(page.locator('[data-admin-view="menu"]')).toHaveClass(/hidden/);
  await expect(page.locator('[data-admin-view="export"]')).toHaveClass(/hidden/);
  await expect(page.locator('[data-admin-panel="orders"]')).toHaveClass(/active/);
  const access = await page.evaluate(async () => ({
    pagnottella: await window.DoseSupplierAccess.canAccessSupplier('pagnottella'),
    russo: await window.DoseSupplierAccess.canAccessSupplier('russo')
  }));
  expect(access).toEqual({ pagnottella:true, russo:false });
});

test('utente DOS completa un ordine senza accedere alle funzioni admin', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Scenario desktop');
  await page.goto('pagnottella-preview/?preview=dos_user&review=sponsor&localPreview=1&swreset=1');
  await expect(page.locator('#recognizedUserDisplay')).toContainText('utente.preview@dos.design · Utente DOS');
  await expect(page.locator('.pagnottellaCard')).toBeEnabled();
  await page.locator('.pagnottellaCard').click();
  await expect(page.locator('#shop')).toHaveClass(/show/);
  await expect(page.locator('#adminWorkspace')).toHaveClass(/hidden/);
  await expect(page.locator('#adminShortcut')).toHaveClass(/hidden/);
  await addProduct(page, 'Saporito', 1, ['Funghi']);
  await page.getByRole('button', { name:'Vedi carrello' }).click();
  await confirmOrder(page);
  await expect(page.locator('#confirm')).toContainText('Ordine');
  const orders = await page.evaluate(() => JSON.parse(localStorage.getItem('dose_preview_pagnottella_orders') || '[]'));
  expect(orders).toHaveLength(1);
  expect(orders[0]).toMatchObject({ email:'utente.preview@dos.design', preview:true });
  await page.evaluate(() => {
    const session = JSON.parse(localStorage.getItem('dose_user') || 'null');
    localStorage.setItem('dose_e2e', '1');
    localStorage.setItem('dose_user', JSON.stringify({ ...session, provider:'google.com' }));
  });
  await page.goto('russo/?suite=approval&e2e=1');
  await expect(page.locator('#user-modal')).toHaveClass(/hidden/);
  await expect(page.locator('#btn-history')).toHaveClass(/hidden/);
});

test('account e domini esterni non possono aprire Pagnottella', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Scenario desktop');
  await page.goto('pagnottella-preview/?preview=external&review=sponsor&localPreview=1&e2e=1&swreset=1');
  await expect(page.locator('#recognizedUserDisplay')).toContainText('test@gmail.com · Non autorizzato');
  await expect(page.locator('.pagnottellaCard')).toBeDisabled();
  await expect(page.locator('.russoCard')).not.toHaveAttribute('href');
  await expect(page.locator('.russoCard')).toHaveAttribute('aria-disabled', 'true');
  await expect(page.locator('#supplierAccessStatus')).toContainText('Account non autorizzato');
  await expect(page.locator('#shop')).not.toHaveClass(/show/);
  await expect(page.locator('#adminWorkspace')).toHaveClass(/hidden/);
});

test('ingredienti aggiuntivi solo sui prodotti personalizzabili', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Scenario desktop');
  for(const product of ['Saporito', 'Reginella']) {
    await page.locator('#search').fill(product);
    await page.locator('#grid .card').filter({ hasText:product }).first().locator('.details').click();
    await expect(page.locator('#drawerExtrasSection')).not.toHaveClass(/hidden/);
    await closeProductDrawer(page);
  }
  for(const product of ['Acqua 0,5 lt', 'Pane e Nutella', 'Apollo']) {
    await page.locator('#search').fill(product);
    await page.locator('#grid .card').filter({ hasText:product }).first().locator('.details').click();
    await expect(page.locator('#drawerExtrasSection')).toHaveClass(/hidden/);
    await expect(page.locator('#drawerExtrasSection')).not.toBeVisible();
    await closeProductDrawer(page);
  }
});

test('personalizzazioni ed extra creano righe distinte e aggiornano il totale', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Scenario desktop');
  await addProduct(page, 'Saporito', 1, ['Funghi']);
  await addProduct(page, 'Saporito', 0);
  await expect(page.locator('#cartItems .checkoutItem')).toHaveCount(2);
  await expect(page.locator('#cartItems')).toContainText('Pane integrale ai cereali');
  await expect(page.locator('#cartItems')).toContainText('Pane bianco');
  await expect(page.locator('#cartItems')).toContainText('Extra: Funghi (+€0,50)');
  await expect(page.locator('#finalTotal')).toHaveText('€13,60');
  await expect(page.locator('#cartCount')).toHaveText('2');
});

test('popup pagamento blocca WhatsApp e gestisce Satispay e bonifico', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Scenario desktop');
  await addProduct(page, 'Saporito');
  await page.getByRole('button', { name:'Vedi carrello' }).click();
  await page.locator('#sendOrderBtn').click();
  await expect(page.locator('#paymentConfirmModal')).toHaveClass(/show/);
  await expect(page.locator('#paymentConfirmCopy')).toHaveText(
    'Prima di finalizzare l’ordine, conferma di aver effettuato il pagamento secondo il metodo selezionato.'
  );
  await page.getByRole('button', { name:'Annulla' }).click();
  await expect(page.locator('#paymentConfirmModal')).not.toHaveClass(/show/);
  expect(await page.evaluate(() => localStorage.getItem('dose_preview_pagnottella_orders'))).toBeNull();

  await page.locator('.paymentOption').filter({ hasText:'Bonifico bancario' }).click();
  await page.locator('#sendOrderBtn').click();
  await expect(page.locator('#paymentConfirmCopy')).toContainText('bonifico deve essere istantaneo');
  await expect(page.locator('#paymentConfirmCopy')).toContainText('allega la ricevuta');
  await confirmOrder(page);

  const orders = await page.evaluate(() => JSON.parse(localStorage.getItem('dose_preview_pagnottella_orders') || '[]'));
  expect(orders).toHaveLength(1);
  expect(orders[0]).toMatchObject({
    user:'Marco Tranquilli',
    email:'marco.tranquilli@dos.design',
    paymentMethod:'Bonifico bancario',
    paymentStatus:'declared_paid',
    reconciled:false,
    preview:true
  });
});

test('WhatsApp include configurazioni ed extra senza preview visibile', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Scenario desktop');
  await addProduct(page, 'Saporito', 1, ['Funghi', 'Pesto']);
  await page.getByRole('button', { name:'Vedi carrello' }).click();
  await expect(page.locator('#waPreview')).toHaveCount(0);
  await page.locator('#sendOrderBtn').click();
  const popupPromise = page.waitForEvent('popup');
  await page.locator('#paymentConfirmAccept').click();
  const popup = await popupPromise;
  const whatsappText = () => new URL(popup.url()).searchParams.get('text') || '';
  await expect.poll(whatsappText).toContain('Pane integrale ai cereali');
  await expect.poll(whatsappText).toContain('Funghi');
  await expect.poll(whatsappText).toContain('Pesto');
  await expect.poll(whatsappText).toContain('entro le 12:00');
  await popup.close();
});

test('ordini giornata, riconciliazione, analisi ed export CSV', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Scenario desktop');
  await addProduct(page, 'Saporito', 1, ['Funghi']);
  await page.getByRole('button', { name:'Vedi carrello' }).click();
  await confirmOrder(page);
  await expect(page.locator('#adminOrdersCount')).toHaveText('1');
  await expect(page.locator('#adminRevenue')).toHaveText('€7,20');
  await expect(page.locator('#adminAverage')).toHaveText('€7,20');
  await expect(page.locator('#adminOrdersList')).toContainText('Pane integrale ai cereali');
  await expect(page.locator('#adminOrdersList')).toContainText('Funghi');
  await expect(page.locator('#adminOrdersList')).toContainText('Dichiarato pagato');
  await page.getByRole('button', { name:'Segna riconciliato' }).click();
  await expect(page.locator('#adminOrdersList')).toContainText('Riconciliato');
  await expect(page.locator('#adminPending')).toHaveText('€0,00');

  await page.locator('[data-admin-view="analytics"]').click();
  await expect(page.locator('[data-admin-panel="analytics"]')).toHaveClass(/active/);
  await expect(page.locator('#analyticsUnique')).toHaveText('1');
  await expect(page.locator('#topProducts')).toContainText('Saporito');

  await page.locator('[data-admin-view="export"]').click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name:'Scarica CSV' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^ordini-pagnottella-.*\.csv$/);
});

test('promo e chiusura restano applicate', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Scenario desktop');
  await page.addInitScript(() => {
    (window as Window & { __PAGNOTTELLA_NOW__?: string }).__PAGNOTTELLA_NOW__ = '2026-08-24T10:00:00+02:00';
  });
  await page.reload();
  await addProduct(page, 'Saporito');
  await expect(page.locator('#discountLabel')).toContainText('20%');
  await expect(page.locator('#finalTotal')).toContainText('€6,40');

  await page.addInitScript(() => {
    (window as Window & { __PAGNOTTELLA_NOW__?: string }).__PAGNOTTELLA_NOW__ = '2026-08-20T10:00:00+02:00';
  });
  await page.reload();
  await expect(page.locator('#service-closure-notice')).toHaveClass(/isActive/);
  await expect(page.locator('#grid .card .add').first()).toBeDisabled();
});

test('filtri, personalizzazione e checkout sono raggiungibili su mobile', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'Scenario mobile');
  await expect(page.locator('#mobileCategoryFilter')).toBeVisible();
  await expect(page.locator('#mobileDietFilter')).toBeVisible();
  await page.locator('#mobileCategoryFilter').selectOption('insalate');
  await page.locator('#mobileDietFilter').selectOption('pescetariana');
  await expect(page.locator('#activeFilterCount')).toHaveText('2');
  await page.locator('.filterTrigger').click();
  await expect(page.locator('#filterPanel')).toHaveClass(/show/);
  await expect(page.locator('.filterApply')).toBeInViewport();
  await page.locator('[data-filter-group="type"][data-filter-value="Insalata"]').click();
  await page.locator('.filterApply').click();
  await expect(page.locator('#activeFilterCount')).toHaveText('3');
  await page.locator('.visibleFilterReset').click();

  await addProduct(page, 'Saporito', 1, ['Funghi']);
  await page.locator('#mobileBar button').click();
  await expect(page.locator('#cart')).toHaveClass(/open/);
  await page.locator('.cartBody').evaluate(element => {
    element.scrollTop = element.scrollHeight;
  });
  await expect(page.locator('#sendOrderBtn')).toBeInViewport();
  await page.locator('#sendOrderBtn').click();
  await expect(page.locator('#paymentConfirmModal')).toHaveClass(/show/);
  await expect(page.locator('#paymentConfirmAccept')).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
