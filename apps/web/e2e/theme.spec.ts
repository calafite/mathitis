import { expect, test } from '@playwright/test';

test.describe('site-wide theme', () => {
  test('defaults to dark theme on first visit', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.locator('html')).toHaveClass(/dark/);
  });

  test('toggling switches the html theme class', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    const toggle = page.getByRole('button', { name: 'Switch to light theme' });
    await expect(toggle).toBeVisible();
    await toggle.click();

    await expect(page.locator('html')).toHaveClass(/light/);
    await expect(page.getByRole('button', { name: 'Switch to dark theme' })).toBeVisible();
  });

  test('theme persists across route navigation and reloads', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    await page.getByRole('button', { name: 'Switch to light theme' }).click();
    await expect(page.locator('html')).toHaveClass(/light/);

    await page.goto('/register');
    await expect(page.locator('html')).toHaveClass(/light/);

    await page.reload();
    await expect(page.locator('html')).toHaveClass(/light/);
    const stored = await page.evaluate(() => localStorage.getItem('mathitis_theme'));
    expect(stored).toBe('light');
  });
});
