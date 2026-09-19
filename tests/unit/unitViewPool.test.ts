import { describe, expect, it } from 'vitest';
import { UnitViewPool } from '../../src/game/UnitViewPool';

describe('UnitViewPool', () => {
  it('reuses released views without allocating after warmup', () => {
    const pool = new UnitViewPool(
      20,
      () => ({ visible: false }),
      (v) => {
        v.visible = false;
      },
    );
    const first = Array.from({ length: 20 }, (_, id) => pool.acquire(id));
    expect(pool.acquire(0)).toBe(first[0]);
    expect(() => pool.acquire(21)).toThrow(/capacity/i);
    pool.releaseAll();
    const second = Array.from({ length: 20 }, (_, id) => pool.acquire(id));
    expect(pool.totalCreated).toBe(20);
    expect(new Set(second)).toEqual(new Set(first));
  });

  it('resets and reuses individual deaths and ignores duplicate release', () => {
    const pool = new UnitViewPool(
      1,
      () => ({ visible: false }),
      (v) => {
        v.visible = false;
      },
    );
    const view = pool.acquire(1);
    view.visible = true;
    pool.release(1);
    pool.release(1);
    expect(view.visible).toBe(false);
    expect(pool.acquire(2)).toBe(view);
    expect(pool.activeCount).toBe(1);
  });
});
