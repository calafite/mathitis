import { expect, test } from '@playwright/test';
import { login } from './helpers';

test.describe('settings portal', () => {
  test('updates semester and appearance preferences with persistence across reloads', async ({
    page,
  }) => {
    await login(page, 'joaopedrosasa');
    await page.goto('/settings');
    await expect(page.getByRole('heading', { name: 'Configurações' })).toBeVisible();

    await page.getByRole('button', { name: 'Período atual' }).click();
    await page.getByRole('option', { name: 'Período 4' }).click();
    await expect(page.getByText('Preferências salvas.')).toBeVisible({ timeout: 15_000 });

    await page.getByRole('tab', { name: /Aparência/ }).click();
    await page.getByRole('button', { name: /Claro/ }).click();
    await expect(page.getByText('Preferências salvas.')).toBeVisible({ timeout: 15_000 });

    await page.reload();
    await expect(page.getByRole('heading', { name: 'Configurações' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Período atual' })).toHaveText(/Período 4/);
    await page.getByRole('tab', { name: /Aparência/ }).click();
    await expect(page.getByRole('button', { name: /Claro/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    // restore defaults
    await page.getByRole('tab', { name: /Conta e Segurança/ }).click();
    await page.getByRole('button', { name: 'Período atual' }).click();
    await page.getByRole('option', { name: 'Período 1', exact: true }).click();
    await page.getByRole('tab', { name: /Aparência/ }).click();
    await page.getByRole('button', { name: /Escuro/ }).click();
    await expect(page.getByText('Preferências salvas.')).toBeVisible({ timeout: 15_000 });
  });

  test('changes password and verifies login with the new password', async ({ page }) => {
    await login(page, 'satanyahu');
    await page.goto('/settings');

    await page.getByLabel(/Senha atual/).fill('TestPassword123!');
    await page.getByLabel(/Nova senha/).fill('FreshPassword456!');
    await page.getByRole('button', { name: 'Atualizar senha' }).click();
    await expect(page.getByText(/senha foi atualizada/i)).toBeVisible({ timeout: 15_000 });

    await page.evaluate(() => {
      document.cookie.split(';').forEach((cookie) => {
        const name = cookie.split('=')[0]?.trim();
        if (name) document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
      });
    });

    await page.goto('/login');
    await page.getByLabel(/Nome ou email/).fill('satanyahu');
    await page.getByLabel(/Senha/).fill('FreshPassword456!');
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page.getByText(/Bem-vindo/)).toBeVisible({
      timeout: 15_000,
    });

    // restore the original password for other tests
    await page.goto('/settings');
    await page.getByLabel(/Senha atual/).fill('FreshPassword456!');
    await page.getByLabel(/Nova senha/).fill('TestPassword123!');
    await page.getByRole('button', { name: 'Atualizar senha' }).click();
    await expect(page.getByText(/senha foi atualizada/i)).toBeVisible({ timeout: 15_000 });
  });

  test('downloads the data export from the Dados e Linhagem tab', async ({ page }) => {
    await login(page, 'joaopedrosasa');
    await page.goto('/settings');
    await page.getByRole('tab', { name: /Dados e Linhagem/ }).click();

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: /Baixar meus dados/i }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('mathitis-data-export.json');
    await expect(page.getByText(/dados foi baixado/i)).toBeVisible({ timeout: 15_000 });
  });

  test('anonymizes the account from the Zona de Risco and blocks subsequent logins', async ({
    page,
  }) => {
    const handle = `e2e_anon_${Date.now()}`;
    await page.goto('/register');
    await page.getByLabel(/Nome de usuário/).fill(handle);
    await page.getByLabel(/Email Acad/i).fill(`${handle}@cs.uni.edu`);
    await page.getByLabel(/Per.odo/).fill('1');
    await page.getByLabel(/Senha/).fill('StrongPassword123!');
    await page.getByRole('button', { name: 'Criar conta' }).click();
    await expect(page.getByRole('heading', { name: 'Verifique seu e-mail' })).toBeVisible();

    // fetch the verification link from the dev mailbox API (as the seeded developer)
    const api = page.request;
    const devLogin = await api.post('http://localhost:4000/api/auth/login', {
      data: { identifier: 'developer', password: 'TestPassword123!' },
    });
    expect(devLogin.status()).toBe(200);
    const devCookies = (devLogin.headers()['set-cookie'] ?? '')
      .split(',')
      .map((c) => c.split(';')[0])
      .join('; ');

    let token: string | null = null;
    for (let attempt = 0; attempt < 40; attempt++) {
      const linkRes = await api.get(
        `http://localhost:4000/api/dev/verification-link?email=${encodeURIComponent(`${handle}@cs.uni.edu`)}`,
        { headers: { cookie: devCookies } },
      );
      expect(linkRes.status()).toBe(200);
      const linkJson = (await linkRes.json()) as { url: string };
      token = linkJson.url ? new URL(linkJson.url).searchParams.get('token') : null;
      if (token) break;
      await page.waitForTimeout(500);
    }
    expect(token).toBeTruthy();

    await page.goto(`/verify-email?token=${token}`);
    await expect(page.getByRole('heading', { name: 'E-mail verificado' })).toBeVisible({
      timeout: 15_000,
    });

    await login(page, handle, 'StrongPassword123!');
    await page.goto('/settings');
    await page.getByRole('tab', { name: /Zona de Risco/ }).click();
    await page
      .getByRole('button', { name: /Anonimizar conta/i })
      .first()
      .click();
    await page.getByLabel(/Digite sua senha para confirmar/).fill('StrongPassword123!');
    await page.locator('form').getByRole('button', { name: 'Anonimizar conta' }).click();

    await expect(page.getByRole('button', { name: 'Entrar' })).toBeVisible({
      timeout: 15_000,
    });

    await page.getByLabel(/Nome ou email/).fill(handle);
    await page.getByLabel(/Senha/).fill('StrongPassword123!');
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page.getByRole('alert')).toBeVisible();
  });
});
