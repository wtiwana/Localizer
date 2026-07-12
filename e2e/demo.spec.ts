import { expect, test } from '@playwright/test';

test.describe('Localizer demo', () => {
  test('registry mode renders core UI', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'Local AI in your browser' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Registry' })).toHaveClass(/active/);
    await expect(page.locator('#mode-badge')).toHaveText('Registry models', { timeout: 10_000 });
    await expect(page.getByRole('heading', { name: 'Try it — ask anything' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'NLP playground' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Summarize' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Classify' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Rewrite' })).toBeVisible();
  });

  test('self-hosted mode shows setup instructions', async ({ page }) => {
    await page.goto('/?mode=self-hosted');

    await expect(page.getByRole('link', { name: 'Self-hosted' })).toHaveClass(/active/);
    await expect(page.locator('#mode-badge')).toHaveText('Self-hosted models', { timeout: 10_000 });
    await expect(page.getByRole('heading', { name: 'Self-hosted setup' })).toBeVisible();
  });

  test('capability panel displays device info', async ({ page }) => {
    await page.goto('/');

    await expect(page.locator('#capability-score')).not.toHaveText('—', { timeout: 10_000 });
    await expect(page.locator('#capability-backend')).not.toHaveText('—');
    await expect(page.locator('#cache-status')).toHaveText('IndexedDB');
  });

  test('widget preview can be toggled', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('button', { name: 'Toggle widget preview' }).click();
    await expect(page.locator('#localizer-widget')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Open Demo Widget' })).toBeVisible();

    await page.getByRole('button', { name: 'Hide widget preview' }).click();
    await expect(page.locator('#localizer-widget')).toHaveCount(0);
  });
});
