import { test } from '@playwright/test';

const roles = {
  user: { name: 'Mario Rossi', email: 'mario.rossi@dos.design' },
  facility: { name: 'Beatrice Binini', email: 'beatrice.binini@dos.design' },
  ristoratore: { name: 'Lorenzo Russo', email: 'lorenzo.russo@alimentarirusso' },
  admin: { name: 'Marco Tranquilli', email: 'marco.tranquilli@dos.design' }
};

async function loginAndSave(page: any, name: string, email: string, storagePath: string) {
  await page.goto('/');
  await page.evaluate(() => localStorage.removeItem('dose_user'));
  await page.reload();
  await page.fill('#user-name-input', name);
  await page.fill('#user-email-input', email);
  await page.click('[data-action="save-user"]');
  await page.waitForTimeout(300);
  await page.context().storageState({ path: storagePath });
}

test('setup user roles', async ({ page }) => {
  await loginAndSave(page, roles.user.name, roles.user.email, 'tests/.auth/user.json');
  await loginAndSave(page, roles.facility.name, roles.facility.email, 'tests/.auth/facility.json');
  await loginAndSave(page, roles.ristoratore.name, roles.ristoratore.email, 'tests/.auth/ristoratore.json');
  await loginAndSave(page, roles.admin.name, roles.admin.email, 'tests/.auth/admin.json');
});
