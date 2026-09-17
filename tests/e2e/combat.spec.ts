import { expect, test } from '@playwright/test';

test('opens the combat prototype shell', async ({ page }) => {
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'Medieval Idle' }),
  ).toBeVisible();
  await expect(page.locator('canvas')).toHaveCount(1);
});
