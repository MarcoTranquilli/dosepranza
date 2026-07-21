import { test, expect } from '@playwright/test';

test('Sicurezza: una cache staff anonima non abilita privilegi', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.removeItem('dose_e2e');
    localStorage.setItem('dose_user', JSON.stringify({
      name: 'Marco Tranquilli',
      email: 'marco.tranquilli@dos.design'
    }));
  });

  await page.goto('/');

  await expect(page.locator('#user-modal')).toBeVisible();
  await expect(page.locator('#menu-admin-toggle')).toBeHidden();
  expect(await page.evaluate(() => localStorage.getItem('dose_user'))).toBeNull();
});

test('Sicurezza: una cache utente standard resta utilizzabile', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.removeItem('dose_e2e');
    localStorage.setItem('dose_user', JSON.stringify({
      name: 'Mario Rossi',
      email: 'mario.rossi@dos.design'
    }));
  });

  await page.goto('/');

  await expect(page.locator('#user-modal')).toBeHidden();
  await expect(page.locator('#menu-view')).toBeVisible();
  await expect(page.locator('#menu-admin-toggle')).toBeHidden();
});

test('Accesso pubblico Russo: nome ed email non riaprono la modale', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.clear();
    localStorage.setItem('dose_e2e', '1');
  });

  await page.goto('/russo/?e2e=1&v=russo-public-3');
  await expect(page.locator('#user-modal')).toBeVisible();
  await page.locator('#user-name-input').fill('Mario Rossi');
  await page.locator('#user-email-input').fill('mario.rossi@dos.design');
  await page.locator('[data-action="save-user"]').click();
  await expect(page.locator('#user-modal')).toBeHidden();

  await page.reload();
  await expect(page.locator('#user-modal')).toBeHidden();
  await expect(page.locator('#menu-view')).toBeVisible();
  await expect(page.locator('#menu-admin-toggle')).toBeHidden();
});

test('Sicurezza: solo una identita Firebase verificata abilita la mappatura staff', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('dose_e2e', '1'));
  await page.goto('/');

  const roles = await page.evaluate(() => {
    const resolve = (window as any).__doseTestResolveVerifiedMappedRole;
    return {
      verifiedAdmin: resolve('marco.tranquilli@dos.design', {
        email: 'marco.tranquilli@dos.design',
        isAnonymous: false,
        providerData: [{ providerId: 'google.com' }]
      }),
      legacyGoogleAdmin: resolve('marco.tranquilli@dos.design', {
        email: null,
        isAnonymous: false,
        providerData: [{ providerId: 'google.com', email: 'marco.tranquilli@dos.design' }]
      }),
      anonymous: resolve('marco.tranquilli@dos.design', {
        email: 'marco.tranquilli@dos.design',
        isAnonymous: true,
        providerData: [{ providerId: 'google.com' }]
      }),
      authenticatedProvider: resolve('marco.tranquilli@dos.design', {
        email: 'marco.tranquilli@dos.design',
        isAnonymous: false,
        providerData: [{ providerId: 'password' }]
      }),
      wrongEmail: resolve('marco.tranquilli@dos.design', {
        email: 'altro@dos.design',
        isAnonymous: false,
        providerData: [{ providerId: 'google.com' }]
      })
    };
  });

  expect(roles).toEqual({
    verifiedAdmin: 'admin',
    legacyGoogleAdmin: 'admin',
    anonymous: '',
    authenticatedProvider: '',
    wrongEmail: ''
  });
});
