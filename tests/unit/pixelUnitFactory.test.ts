import { expect, it } from 'vitest';
import { unitPixels } from '../../src/game/PixelUnitFactory';
import { UNIT_TYPES } from '../../src/domain/army';

it('produces distinct hard-edged silhouettes, team palettes and animation frames', () => {
  const silhouettes = UNIT_TYPES.map((type) =>
    JSON.stringify(unitPixels(type, 'left', 0, 'march')),
  );
  expect(new Set(silhouettes).size).toBe(4);
  for (const type of UNIT_TYPES) {
    const march = unitPixels(type, 'left', 0, 'march');
    expect(march).not.toEqual(unitPixels(type, 'right', 0, 'march'));
    expect(march).not.toEqual(unitPixels(type, 'left', 1, 'march'));
    expect(march).not.toEqual(unitPixels(type, 'left', 1, 'attack'));
    expect(
      march.every((p) => [p.x, p.y, p.width, p.height].every(Number.isInteger)),
    ).toBe(true);
    expect(
      march.every(
        (p) =>
          p.x >= 0 && p.y >= 0 && p.x + p.width <= 20 && p.y + p.height <= 20,
      ),
    ).toBe(true);
  }
});
