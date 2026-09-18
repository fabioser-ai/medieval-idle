import { expect, test } from '@playwright/test';

test('opens the combat prototype shell', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'Medieval Idle' }),
  ).toBeVisible();
  await expect(page.locator('canvas')).toHaveCount(1);
  await expect(page.locator('canvas')).toHaveAttribute('width', '480');
  await expect(page.locator('canvas')).toHaveAttribute('height', '270');
  await expect(page.locator('canvas')).toHaveAttribute(
    'data-phase',
    /gates|marching|charging|fighting/,
  );
  expect(errors).toEqual([]);
});
