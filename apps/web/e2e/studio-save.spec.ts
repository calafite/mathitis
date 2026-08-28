import { expect, test } from '@playwright/test';
import { login } from './helpers';

test('studio save persists tagline after reload', async ({ page }) => {
  await login(page, 'joaopedrosasa');
  await page.goto('/profile/studio');
  await expect(page.getByRole('heading', { name: 'Estúdio de Perfil' })).toBeVisible({
    timeout: 15_000,
  });

  const stamp = `Persist ${Date.now()}`;
  const tagline = page.getByPlaceholder('Uma frase curta');
  await expect(tagline).toBeVisible({ timeout: 15_000 });
  await tagline.fill(stamp);

  // Floating save bar appears while dirty
  const bar = page.getByText('Você tem alterações não salvas no seu perfil');
  await expect(bar).toBeVisible();

  await page.getByRole('button', { name: 'Salvar alterações' }).last().click();
  await expect(bar).toBeHidden({ timeout: 15_000 });

  // Reload and verify persistence
  await page.reload();
  await expect(page.getByPlaceholder('Uma frase curta')).toHaveValue(stamp, { timeout: 15_000 });
});

test('studio surfaces a visible error when saving invalid data', async ({ page }) => {
  await login(page, 'joaopedrosasa');
  await page.goto('/profile/studio');
  await expect(page.getByRole('heading', { name: 'Estúdio de Perfil' })).toBeVisible({
    timeout: 15_000,
  });

  const github = page.getByPlaceholder('https://github.com/you');
  await expect(github).toBeVisible({ timeout: 15_000 });
  await github.fill('github.com/sem-protocolo');

  const bar = page.getByText('Você tem alterações não salvas no seu perfil');
  await expect(bar).toBeVisible();

  await page.getByRole('button', { name: 'Salvar alterações' }).last().click();

  // The failure must be explicit, never silent.
  await expect(page.getByRole('alert').filter({ hasText: /URL|salvar/i })).toBeVisible({
    timeout: 15_000,
  });
  await expect(bar).toBeVisible();
});
