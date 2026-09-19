import { expect, test } from '@playwright/test';

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 844, height: 390 },
]) {
  test(`deploys two formations with viewing-only controls at ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.setViewportSize(viewport);
    await page.goto('/');
    await expect(
      page.getByRole('heading', { name: 'Medieval Idle', exact: true }),
    ).toBeVisible();
    await expect(page.locator('canvas')).toHaveAttribute('width', '480');
    await expect(page.locator('canvas')).toHaveAttribute('height', '270');
    await expect(page.locator('canvas')).toHaveAttribute(
      'data-phase',
      'preparing',
    );
    await expect(
      page.getByRole('group', {
        name: /^(Front|Middle|Rear|Left flank|Right flank)$/,
      }),
    ).toHaveCount(5);
    await expect(
      page.getByRole('button', { name: 'To Battle' }),
    ).toBeDisabled();
    await page.getByLabel('Front quantity').fill('-1');
    await expect(page.getByRole('status')).toContainText('Front quantity');
    await page.getByLabel('Front quantity').fill('8');
    await page.getByLabel('Front recruit %').fill('50');
    await page.getByLabel('Front trained %').fill('50');
    await page.getByLabel('Rear unit type').selectOption('archer');
    await page.getByLabel('Rear quantity').fill('6');
    await expect(page.getByRole('button', { name: 'To Battle' })).toBeEnabled();
    const assertLayout = async () => {
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      for (const control of await page
        .locator('button:visible, input:visible, select:visible')
        .all()) {
        const box = await control.boundingBox();
        expect(box!.width).toBeGreaterThanOrEqual(44);
        expect(box!.height).toBeGreaterThanOrEqual(44);
      }
      const canvas = await page.locator('canvas').boundingBox();
      expect(canvas!.width).toBeLessThanOrEqual(viewport.width);
      expect(canvas!.height).toBeLessThanOrEqual(viewport.height);
      expect(canvas!.x).toBeGreaterThanOrEqual(0);
      expect(
        await page
          .getByRole('status')
          .evaluate((el) => parseFloat(getComputedStyle(el).fontSize)),
      ).toBeGreaterThanOrEqual(14);
    };
    await assertLayout();
    await page.getByRole('button', { name: 'To Battle' }).click();
    await expect(
      page.getByRole('region', { name: 'Deploy your army' }),
    ).toBeHidden();
    await expect(page.locator('input:visible, select:visible')).toHaveCount(0);
    await expect(page.locator('button:visible')).toHaveText([
      'Pause',
      '1×',
      '2×',
      '4×',
    ]);
    await page.getByRole('button', { name: 'Pause', exact: true }).click();
    await expect(page.getByRole('status')).toContainText('Paused');
    const time = await page
      .locator('canvas')
      .getAttribute('data-playback-time');
    await page.waitForTimeout(150);
    await expect(page.locator('canvas')).toHaveAttribute(
      'data-playback-time',
      time!,
    );
    for (const speed of ['1×', '2×', '4×']) {
      await page.getByRole('button', { name: speed, exact: true }).click();
      await expect(
        page.getByRole('button', { name: speed, exact: true }),
      ).toHaveAttribute('aria-pressed', 'true');
    }
    await assertLayout();
    expect(errors).toEqual([]);
  });
}
