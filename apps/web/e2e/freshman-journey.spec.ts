import { expect, test } from '@playwright/test';
import { login } from './helpers';

test.describe('Freshman journey', () => {
  test('bumps a senior and submits a mentorship request', async ({ page }) => {
    await login(page, 'alan_loops');
    await page.getByRole('link', { name: 'Discovery' }).click();

    const seniorCard = page.locator('div.rounded-xl').filter({ hasText: 'ada_math' }).first();
    await expect(seniorCard).toBeVisible({ timeout: 15_000 });

    await seniorCard.getByRole('button', { name: 'Request' }).click();
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 15_000 });
    await page
      .getByPlaceholder(/Introduce yourself/)
      .fill('Hi Ada, I would love to study real analysis together this semester.');
    await page.getByRole('button', { name: 'Send request' }).click();

    await page.goto('/requests');
    await expect(page.getByRole('heading', { name: 'Mentorship requests' })).toBeVisible();
    const row = page.locator('div.rounded-xl').filter({ hasText: 'Ada' }).first();
    await expect(row).toBeVisible({ timeout: 15_000 });
    await expect(row.getByText('Pending')).toBeVisible();
  });

  test('customizes the profile via the studio', async ({ page }) => {
    await login(page, 'alan_loops');
    await page.getByRole('link', { name: 'Profile studio' }).click();

    const textarea = page.getByPlaceholder(/Tell your story/);
    await expect(textarea).toBeVisible({ timeout: 15_000 });
    await textarea.fill('I solve hard problems.\n\n[Highlight me]{color=#ec4899}');
    await page.getByTitle('Badge').click();

    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByRole('button', { name: 'Saved' })).toBeVisible({ timeout: 15_000 });
  });
});
