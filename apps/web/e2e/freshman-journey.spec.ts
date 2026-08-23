import { expect, test } from '@playwright/test';
import { login } from './helpers';

test.describe('Freshman journey', () => {
  test('bumps a senior and submits a mentorship request', async ({ page }) => {
    await login(page, 'alan_loops');
    await page.getByRole('link', { name: 'Descoberta de mentores' }).click();

    const seniorCard = page.locator('div.rounded-xl').filter({ hasText: 'Ada' }).first();
    await expect(seniorCard).toBeVisible({ timeout: 15_000 });

    // Click the senior's name to open the mentor profile modal
    await seniorCard.getByRole('button', { name: 'Ada' }).click();
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 15_000 });

    // Click "Pedir apadrinhamento" in the modal (scroll inside the dialog first)
    const applyBtn = page.getByRole('button', { name: 'Pedir apadrinhamento' });
    await expect(applyBtn).toBeVisible({ timeout: 15_000 });
    await applyBtn.scrollIntoViewIfNeeded();
    await applyBtn.click();

    // Wait for the request to be sent (modal closes)
    await expect(page.getByRole('dialog')).toBeHidden({ timeout: 15_000 });

    await page.goto('/requests');
    await expect(page.getByRole('heading', { name: 'Pedidos de apadrinhamento' })).toBeVisible();
    const row = page.locator('div.rounded-xl').filter({ hasText: 'Ada' }).first();
    await expect(row).toBeVisible({ timeout: 15_000 });
    await expect(row.getByText('Pendente')).toBeVisible();
  });

  test('customizes the profile via the studio', async ({ page }) => {
    await login(page, 'alan_loops');
    await page.getByRole('link', { name: 'Estúdio de perfil' }).click();

    const textarea = page.getByPlaceholder(/Conte sua história/);
    await expect(textarea).toBeVisible({ timeout: 15_000 });
    await textarea.fill('I solve hard problems.\n\n[Highlight me]{color=#ec4899}');
    await page.getByTitle('Emblema').click();

    await page.getByRole('button', { name: 'Salvar alterações' }).click();
    await expect(page.getByRole('button', { name: 'Salvo' })).toBeVisible({ timeout: 15_000 });
  });
});
