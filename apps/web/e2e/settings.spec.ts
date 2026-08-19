import { expect, test } from '@playwright/test';
import { login } from './helpers';

test.describe('settings portal', () => {
  test('updates semester and appearance preferences with persistence across reloads', async ({
    page,
  }) => {
    await login(page, 'alan_loops');
    await page.goto('/settings');
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();

    await page.selectOption('#semester', '4');
    await expect(page.getByText('Preferences saved.')).toBeVisible({ timeout: 15_000 });

    await page.getByRole('tab', { name: /Appearance/ }).click();
    await page.getByRole('button', { name: /Light/ }).click();
    await expect(page.getByText('Preferences saved.')).toBeVisible({ timeout: 15_000 });

    await page.reload();
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
    await expect(page.locator('#semester')).toHaveValue('4');
    await page.getByRole('tab', { name: /Appearance/ }).click();
    await expect(page.getByRole('button', { name: /Light/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    // restore defaults
    await page.getByRole('tab', { name: /Account & Security/ }).click();
    await page.selectOption('#semester', '1');
    await page.getByRole('tab', { name: /Appearance/ }).click();
    await page.getByRole('button', { name: /Dark/ }).click();
    await expect(page.getByText('Preferences saved.')).toBeVisible({ timeout: 15_000 });
  });

  test('changes password and verifies login with the new password', async ({ page }) => {
    await login(page, 'ada_math');
    await page.goto('/settings');

    await page.getByLabel(/Current password/).fill('TestPassword123!');
    await page.getByLabel(/New password/).fill('FreshPassword456!');
    await page.getByRole('button', { name: 'Update password' }).click();
    await expect(page.getByText(/password has been updated/i)).toBeVisible({ timeout: 15_000 });

    await page.evaluate(() => {
      document.cookie.split(';').forEach((cookie) => {
        const name = cookie.split('=')[0]?.trim();
        if (name) document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
      });
    });

    await page.goto('/login');
    await page.getByLabel(/Handle or email/).fill('ada_math');
    await page.getByLabel(/Password/).fill('FreshPassword456!');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByRole('heading', { name: /Welcome,/ })).toBeVisible({
      timeout: 15_000,
    });

    // restore the original password for other tests
    await page.goto('/settings');
    await page.getByLabel(/Current password/).fill('FreshPassword456!');
    await page.getByLabel(/New password/).fill('TestPassword123!');
    await page.getByRole('button', { name: 'Update password' }).click();
    await expect(page.getByText(/password has been updated/i)).toBeVisible({ timeout: 15_000 });
  });

  test('downloads the data export from the Data & Lineage tab', async ({ page }) => {
    await login(page, 'alan_loops');
    await page.goto('/settings');
    await page.getByRole('tab', { name: /Data & Lineage/ }).click();

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: /Download my data/i }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('mathitis-data-export.json');
    await expect(page.getByText(/export has been downloaded/i)).toBeVisible({ timeout: 15_000 });
  });

  test('anonymizes the account from the Danger Zone and blocks subsequent logins', async ({
    page,
  }) => {
    const handle = `e2e_anon_${Date.now()}`;
    await page.goto('/register');
    await page.getByLabel(/Handle/).fill(handle);
    await page.getByLabel(/University email/).fill(`${handle}@cs.uni.edu`);
    await page.getByLabel(/^Semester/).fill('1');
    await page.getByLabel(/Password/).fill('StrongPassword123!');
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page.getByRole('heading', { name: 'Check your inbox' })).toBeVisible();

    // fetch the verification link from the dev mailbox API (as the seeded developer)
    const api = page.request;
    const devLogin = await api.post('http://localhost:4000/api/auth/login', {
      data: { identifier: 'developer', password: 'TestPassword123!' },
    });
    expect(devLogin.status()).toBe(200);
    const devCookies = (devLogin.headers()['set-cookie'] ?? '').split(',').map((c) => c.split(';')[0]).join('; ');

    let token: string | null = null;
    for (let attempt = 0; attempt < 20; attempt++) {
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
    await expect(page.getByRole('heading', { name: 'Email verified' })).toBeVisible({
      timeout: 15_000,
    });

    await login(page, handle, 'StrongPassword123!');
    await page.goto('/settings');
    await page.getByRole('tab', { name: /Danger Zone/ }).click();
    await page.getByRole('button', { name: /Anonymize account/i }).first().click();
    await page.getByLabel(/Enter your password to confirm/).fill('StrongPassword123!');
    await page.locator('form').getByRole('button', { name: 'Anonymize account' }).click();

    await expect(page.getByRole('heading', { name: 'Sign in to Mathitis' })).toBeVisible({
      timeout: 15_000,
    });

    await page.getByLabel(/Handle or email/).fill(handle);
    await page.getByLabel(/Password/).fill('StrongPassword123!');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByRole('alert')).toBeVisible();
  });
});