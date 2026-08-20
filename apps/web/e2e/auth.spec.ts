import { expect, test } from '@playwright/test';
import { login } from './helpers';

const REGISTER_GENERIC = 'you will receive a verification email shortly';

test.describe('email enumeration prevention (UI)', () => {
  test('register with an existing email returns the identical generic success screen', async ({
    page,
  }) => {
    await page.goto('/register');
    await page.getByLabel(/Handle/).fill(`e2e_dup_${Date.now()}`);
    await page.getByLabel(/University email/).fill('ada@cs.uni.edu');
    await page.getByLabel(/^Semester/).fill('2');
    await page.getByLabel(/Password/).fill('StrongPassword123!');
    await page.getByRole('button', { name: 'Create account' }).click();

    await expect(page.getByRole('heading', { name: 'Check your inbox' })).toBeVisible();
    await expect(page.getByText(REGISTER_GENERIC)).toBeVisible();
  });

  test('register with a new email returns the same generic success screen', async ({ page }) => {
    await page.goto('/register');
    const handle = `e2e_fresh_${Date.now()}`;
    await page.getByLabel(/Handle/).fill(handle);
    await page.getByLabel(/University email/).fill(`${handle}@cs.uni.edu`);
    await page.getByLabel(/^Semester/).fill('2');
    await page.getByLabel(/Password/).fill('StrongPassword123!');
    await page.getByRole('button', { name: 'Create account' }).click();

    await expect(page.getByRole('heading', { name: 'Check your inbox' })).toBeVisible();
    await expect(page.getByText(REGISTER_GENERIC)).toBeVisible();
  });

  test('password recovery is identical for existing and missing emails', async ({ page }) => {
    await page.goto('/recover');
    await expect(page.getByRole('heading', { name: 'Reset your password' })).toBeVisible({
      timeout: 15_000,
    });

    await page.getByRole('textbox', { name: /email/i }).fill('ada@cs.uni.edu');
    await page.getByRole('button', { name: /Send reset link/i }).click();
    await expect(page.getByText('a reset link has been sent')).toBeVisible({ timeout: 15_000 });

    await page.goto('/recover');
    await expect(page.getByRole('heading', { name: 'Reset your password' })).toBeVisible({
      timeout: 15_000,
    });
    await page.getByRole('textbox', { name: /email/i }).fill('nobody@cs.uni.edu');
    await page.getByRole('button', { name: /Send reset link/i }).click();
    await expect(page.getByText('a reset link has been sent')).toBeVisible({ timeout: 15_000 });
  });

  test('rejects invalid credentials with a visible error', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/Nome ou email/).fill('alan_loops');
    await page.getByLabel(/Password/).fill('WrongPassword123!');
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test('signs in a seeded active user', async ({ page }) => {
    await login(page, 'alan_loops');
    await expect(
      page.getByRole('heading', { name: /Welcome,/ }),
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/freshman/i)).toBeVisible({ timeout: 15_000 });
  });
});
