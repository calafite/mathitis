import { expect, test } from '@playwright/test';
import { login } from './helpers';

test.describe('Lineage graph', () => {
  test('renders the mentorship graph after a request is accepted', async ({ page }) => {
    await login(page, 'joaopedrosasa');
    await page.getByRole('navigation').getByRole('link', { name: 'Linhagem' }).click();

    await expect(page.getByRole('heading', { name: 'Linhagem de apadrinhamento' })).toBeVisible();
    await expect(page.getByText('@satanyahu')).toBeVisible({ timeout: 15_000 });
  });

  test('renders a handle-scoped subgraph', async ({ page }) => {
    await login(page, 'joaopedrosasa');
    await page.goto('/lineage/satanyahu');

    await expect(page.getByText('Subgrafo com raiz em @satanyahu')).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.locator('svg').getByText(/@satanyahu/)).toBeVisible();
  });
});
