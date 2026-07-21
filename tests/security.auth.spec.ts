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

test('Sicurezza: solo Google verificato abilita la mappatura staff', async ({ page }) => {
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
      anonymous: resolve('marco.tranquilli@dos.design', {
        email: 'marco.tranquilli@dos.design',
        isAnonymous: true,
        providerData: [{ providerId: 'google.com' }]
      }),
      wrongProvider: resolve('marco.tranquilli@dos.design', {
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
    anonymous: '',
    wrongProvider: '',
    wrongEmail: ''
  });
});
