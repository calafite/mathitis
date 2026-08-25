import { expect, type Page } from '@playwright/test';

export const SEED_PASSWORD = 'TestPassword123!';

export async function login(page: Page, handle: string, password = SEED_PASSWORD) {
  await page.goto('/login');
  await page.getByLabel(/Nome ou email/).fill(handle);
  await page.getByLabel(/Senha/).fill(password);
  await page.getByRole('button', { name: 'Entrar' }).click();
  // Wait for the redirect AND the authenticated home to render — guarantees
  // the session cookie is set and /api/auth/me succeeded before the caller
  // navigates anywhere else.
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 15_000 });
  await expect(page.getByText(/Bem-vindo/)).toBeVisible({ timeout: 15_000 });
}

export async function logout(page: Page) {
  await page.evaluate(() => {
    document.cookie.split(';').forEach((cookie) => {
      const name = cookie.split('=')[0]?.trim();
      if (name) document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
    });
  });
  await page.goto('/login');
  await expect(page.getByRole('button', { name: 'Entrar' })).toBeVisible();
}
