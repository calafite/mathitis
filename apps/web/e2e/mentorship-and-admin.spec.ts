import { expect, test } from '@playwright/test';
import { login } from './helpers';

test.describe('Senior mentorship flow', () => {
  test('accepts an incoming mentorship request', async ({ page }) => {
    await login(page, 'ada_math');

    await page.getByRole('link', { name: 'Pedidos', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Pedidos de apadrinhamento' })).toBeVisible();

    const incoming = page.getByRole('button', { name: 'Recebidos' });
    await expect(incoming).toBeVisible();
    await incoming.click();

    const row = page.locator('div.rounded-xl').filter({ hasText: 'Alan' }).first();
    await expect(row.getByText('Pendente')).toBeVisible({ timeout: 15_000 });

    await row.getByRole('button', { name: 'Aceitar' }).click();
    await expect(row.getByText('Aceito')).toBeVisible({ timeout: 15_000 });
  });
});

test.describe('Administrative workflow', () => {
  test('toggles configuration and sees it in the audit log', async ({ page }) => {
    await login(page, 'admin');

    await page.getByRole('link', { name: 'Admin' }).click();
    await expect(page).toHaveURL(/\/admin/);

    await page.getByRole('link', { name: 'Configuração' }).click();
    const toggle = page.getByLabel('Permitir novos registros');
    await expect(toggle).toBeVisible({ timeout: 15_000 });
    await toggle.uncheck();
    await page.getByRole('button', { name: 'Salvar alterações' }).click();
    await expect(page.getByText('Salvo.')).toBeVisible({ timeout: 15_000 });

    // reload so the local draft syncs with the saved server state, then restore the setting
    await page.reload();
    await expect(page.getByLabel('Permitir novos registros')).toBeVisible({ timeout: 15_000 });
    await page.getByLabel('Permitir novos registros').check();
    await page.getByRole('button', { name: 'Salvar alterações' }).click();
    await expect(page.getByText('Salvo.')).toBeVisible({ timeout: 15_000 });

    await page.getByRole('link', { name: 'Registro de auditoria' }).click();
    await expect(
      page.getByRole('heading', { name: 'Registro de auditoria' }),
    ).toBeVisible({ timeout: 15_000 });
    await expect(
      page.locator('div.w-64.shrink-0.truncate.font-mono.text-xs.text-primary').first(),
    ).toBeVisible({ timeout: 15_000 });
  });
});
