import { expect, test } from '@playwright/test';

test('normal-route depleted campaign recovery is explicit, cancelable, persisted, and playable', async ({
  page,
}) => {
  await page.goto('/');
  await page.evaluate(() =>
    localStorage.setItem(
      'medieval-idle.save',
      JSON.stringify({
        schemaVersion: 1,
        kingdom: 'Alderwatch',
        availableCohorts: [],
        reservedTrainerCohorts: [],
        lastSeed: 626,
        lastResult: {
          outcome: 'victory',
          winner: 'right',
          durationTicks: 2132,
          leftSurvivors: 0,
          rightSurvivors: 1,
        },
      }),
    ),
  );
  await page.reload();
  await expect(page.getByRole('button', { name: 'To Battle' })).toBeDisabled();
  await page
    .getByRole('button', { name: 'Start new campaign', exact: true })
    .click();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.reload();
  await expect(page.locator('#inventory-infantry')).toContainText('Recruit 0');
  await expect(page.locator('#last-result')).toContainText('right wins');
  await page
    .getByRole('button', { name: 'Start new campaign', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Confirm new campaign', exact: true })
    .click();
  await page.reload();
  await expect(
    page.getByRole('button', { name: 'Start new campaign', exact: true }),
  ).toHaveCount(0);
  await expect(page.locator('#inventory-infantry')).toContainText('Recruit 12');
  await expect(page.locator('#last-result')).toContainText(
    'No completed battle',
  );
  await page.getByLabel('Front quantity').fill('4');
  await page.getByRole('button', { name: 'To Battle' }).click();
  await expect(
    page.getByRole('navigation', { name: 'Battle playback' }),
  ).toBeVisible();
});

for (const scenario of [
  {
    id: 'equal-infantry',
    outcome: 'draw',
    winner: null,
    ticks: 6620,
    left: 0,
    right: 0,
  },
  {
    id: 'veteran-line',
    outcome: 'victory',
    winner: 'right',
    ticks: 2393,
    left: 0,
    right: 90,
  },
  {
    id: 'spear-and-bow',
    outcome: 'victory',
    winner: 'right',
    ticks: 1646,
    left: 0,
    right: 40,
  },
  {
    id: 'archer-rear',
    outcome: 'victory',
    winner: 'left',
    ticks: 1897,
    left: 1,
    right: 0,
  },
  {
    id: 'archer-front',
    outcome: 'victory',
    winner: 'right',
    ticks: 2132,
    left: 0,
    right: 1,
  },
]) {
  test(`terminal outcome and persisted survivors: ${scenario.id}`, async ({
    page,
  }) => {
    test.setTimeout(150_000);
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    await page.goto('/?dev=1');
    await page
      .getByText('Developer acceptance presets', { exact: true })
      .click();
    await page.getByLabel('Acceptance preset').selectOption(scenario.id);
    await expect(page.getByRole('button', { name: 'To Battle' })).toBeEnabled();
    await page.getByRole('button', { name: 'To Battle' }).click();
    await expect(
      page.getByRole('button', { name: '4×', exact: true }),
    ).toHaveAttribute('aria-pressed', 'true');
    // Summary is written only when the sole renderer clock reaches terminal result.
    await expect(page.locator('#last-result')).toContainText(
      `Last result: ${scenario.outcome}`,
      { timeout: 125_000 },
    );
    await expect(page.locator('#last-result')).toContainText(
      `survivors left ${scenario.left} · right ${scenario.right}`,
    );
    const before = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('medieval-idle.save')!),
    );
    expect(before.lastResult).toEqual({
      outcome: scenario.outcome,
      winner: scenario.winner,
      durationTicks: scenario.ticks,
      leftSurvivors: scenario.left,
      rightSurvivors: scenario.right,
    });
    expect(before.lastSeed).toBe(626);
    expect(before.availableCohorts).toEqual(
      scenario.left === 1
        ? [{ type: 'archer', tier: 'trained', count: 1, survivedVictories: 1 }]
        : [],
    );
    await page.reload();
    await expect(page.locator('canvas')).toHaveAttribute(
      'data-phase',
      'preparing',
    );
    await expect(page.locator('#last-result')).toContainText(
      `survivors left ${scenario.left} · right ${scenario.right}`,
    );
    expect(
      await page.evaluate(() =>
        JSON.parse(localStorage.getItem('medieval-idle.save')!),
      ),
    ).toEqual(before);
    await expect(page.locator('#inventory-archer')).toContainText(
      `Trained ${scenario.left}`,
    );
    expect(errors).toEqual([]);
  });
}

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
      expect(canvas!.y).toBeGreaterThanOrEqual(0);
      expect(canvas!.x + canvas!.width).toBeLessThanOrEqual(viewport.width);
      expect(canvas!.y + canvas!.height).toBeLessThanOrEqual(viewport.height);
      expect(canvas!.width / canvas!.height).toBeCloseTo(16 / 9, 2);
      if (
        await page
          .getByRole('navigation', { name: 'Battle playback' })
          .isVisible()
      ) {
        // Phaser FIT periodically rechecks parent bounds after the UI row appears.
        await expect
          .poll(async () => {
            const field = await page.locator('canvas').boundingBox();
            const controls = await page.locator('#battle-ui').boundingBox();
            return (
              controls!.y >= field!.y + field!.height &&
              controls!.y + controls!.height <= viewport.height
            );
          })
          .toBe(true);
      }
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
    await expect(
      page.getByRole('button', { name: '4×', exact: true }),
    ).toHaveAttribute('aria-pressed', 'true');
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
