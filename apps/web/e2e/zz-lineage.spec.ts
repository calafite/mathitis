import { expect, test } from '@playwright/test';
import { login } from './helpers';

test.describe('Lineage graph', () => {
  test('renders the mentorship graph after a request is accepted', async ({ page }) => {
    await login(page, 'alan_loops');
    await page.getByRole('link', { name: 'Lineage' }).click();

    await expect(page.getByRole('heading', { name: 'Mentorship lineage' })).toBeVisible();
    await expect(page.getByText('@ada_math')).toBeVisible({ timeout: 15_000 });
  });

  test('renders a handle-scoped subgraph', async ({ page }) => {
    await login(page, 'alan_loops');
    await page.goto('/lineage/ada_math');

    await expect(page.getByText('Subgraph rooted at @ada_math')).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.locator('svg').getByText(/@ada_math/)).toBeVisible();
  });
});
