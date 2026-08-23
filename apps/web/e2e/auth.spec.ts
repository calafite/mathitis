import { expect, test } from '@playwright/test';
import { login } from './helpers';

const REGISTER_GENERIC = 'você receberá uma mensagem de confirmação';

test.describe('email enumeration prevention (UI)', () => {
  test('register with an existing email returns the identical generic success screen', async ({
    page,
  }) => {
    await page.goto('/register');
    await page.getByLabel(/Nome de usuário/).fill(`e2e_dup_${Date.now()}`);
    await page.getByLabel(/Email Acadêmico/).fill('ada@cs.uni.edu');
    await page.getByLabel(/^Período/).fill('2');
    await page.getByLabel(/^Senha/).fill('StrongPassword123!');
    await page.getByRole('button', { name: 'Criar conta' }).click();

    await expect(page.getByRole('heading', { name: 'Verifique seu e-mail' })).toBeVisible();
    await expect(page.getByText(REGISTER_GENERIC)).toBeVisible();
  });

  test('register with a new email returns the same generic success screen', async ({ page }) => {
    await page.goto('/register');
    const handle = `e2e_fresh_${Date.now()}`;
    await page.getByLabel(/Nome de usuário/).fill(handle);
    await page.getByLabel(/Email Acadêmico/).fill(`${handle}@cs.uni.edu`);
    await page.getByLabel(/^Período/).fill('2');
    await page.getByLabel(/^Senha/).fill('StrongPassword123!');
    await page.getByRole('button', { name: 'Criar conta' }).click();

    await expect(page.getByRole('heading', { name: 'Verifique seu e-mail' })).toBeVisible();
    await expect(page.getByText(REGISTER_GENERIC)).toBeVisible();
  });

  test('password recovery is identical for existing and missing emails', async ({ page }) => {
    await page.goto('/recover');
    await expect(page.getByRole('heading', { name: 'Redefinir sua senha' })).toBeVisible({
      timeout: 15_000,
    });

    await page.getByLabel(/E-mail/).fill('ada@cs.uni.edu');
    await page.getByRole('button', { name: /Enviar link de redefinição/i }).click();
    await expect(page.getByText('um link de redefinição foi enviado')).toBeVisible({
      timeout: 15_000,
    });

    await page.goto('/recover');
    await expect(page.getByRole('heading', { name: 'Redefinir sua senha' })).toBeVisible({
      timeout: 15_000,
    });
    await page.getByLabel(/E-mail/).fill('nobody@cs.uni.edu');
    await page.getByRole('button', { name: /Enviar link de redefinição/i }).click();
    await expect(page.getByText('um link de redefinição foi enviado')).toBeVisible({
      timeout: 15_000,
    });
  });

  test('rejects invalid credentials with a visible error', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/Nome ou email/).fill('alan_loops');
    await page.getByLabel(/Senha/).fill('WrongPassword123!');
    await page.getByRole('button', { name: 'Entrar' }).click();

    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test('signs in a seeded active user', async ({ page }) => {
    await login(page, 'alan_loops');
    await expect(
      page.getByRole('heading', { name: /Bem-vindo/ }),
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/Calouro/).first()).toBeVisible({ timeout: 15_000 });
  });
});
