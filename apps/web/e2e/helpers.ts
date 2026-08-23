import { expect, type Page } from '@playwright/test';

export const SEED_PASSWORD = 'TestPassword123!';

export async function login(page: Page, handle: string, password = SEED_PASSWORD) {
  await page.goto('/login');
  await page.getByLabel(/Nome ou email/).fill(handle);
  await page.getByLabel(/Senha/).fill(password);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page.getByRole('heading', { name: 'Junte-se ao Apadrinhamento' })).toBeHidden();
}

export async function logout(page: Page) {
  await page.evaluate(() => {
    document.cookie.split(';').forEach((cookie) => {
      const name = cookie.split('=')[0]?.trim();
      if (name) document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
    });
  });
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'Junte-se ao Apadrinhamento' })).toBeVisible();
}
