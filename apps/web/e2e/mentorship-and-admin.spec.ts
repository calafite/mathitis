import { expect, test } from '@playwright/test';
import { login } from './helpers';

test.describe('Senior mentorship flow', () => {
  test('accepts an incoming mentorship request', async ({ page }) => {
    await login(page, 'ada_math');

    await page.getByRole('link', { name: 'Mentorship Requests' }).click();
    await expect(page.getByRole('heading', { name: 'Mentorship requests' })).toBeVisible();

    const incoming = page.getByText('Incoming');
    await expect(incoming).toBeVisible();
    await incoming.click();

    const row = page.locator('div.rounded-xl').filter({ hasText: 'Alan' }).first();
    await expect(row.getByText('Pending')).toBeVisible({ timeout: 15_000 });

    await row.getByRole('button', { name: 'Accept' }).click();
    await expect(row.getByText('Accepted')).toBeVisible({ timeout: 15_000 });
  });
});

test.describe('Administrative workflow', () => {
  test('toggles configuration and sees it in the audit log', async ({ page }) => {
    await login(page, 'admin');

    await page.getByRole('link', { name: 'Admin' }).click();
    await expect(page).toHaveURL(/\/admin/);

    await page.getByRole('link', { name: 'Configuration' }).click();
    const toggle = page.getByLabel('Allow new registrations');
    await expect(toggle).toBeVisible({ timeout: 15_000 });
    await toggle.uncheck();
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByText('Saved.')).toBeVisible({ timeout: 15_000 });

    // reload so the local draft syncs with the saved server state, then restore the setting
    await page.reload();
    await expect(page.getByLabel('Allow new registrations')).toBeVisible({ timeout: 15_000 });
    await page.getByLabel('Allow new registrations').check();
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByText('Saved.')).toBeVisible({ timeout: 15_000 });

    await page.getByRole('link', { name: 'Audit log' }).click();
    await expect(page.getByRole('heading', { name: 'Audit log' })).toBeVisible({ timeout: 15_000 });
    await expect(
      page.locator('div.w-64.shrink-0.truncate.font-mono.text-xs.text-indigo-700').first(),
    ).toBeVisible({ timeout: 15_000 });
  });
});
