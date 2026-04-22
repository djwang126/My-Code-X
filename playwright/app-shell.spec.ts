import { expect, test } from '@playwright/test';

test('app shell bootstraps and renders the replacement heading', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'My code X' })).toBeVisible();
  await expect(page.getByText('Session synced')).toBeVisible();
  await expect(page.getByText('Select a workspace to start chatting')).toBeVisible();
});
