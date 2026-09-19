import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { simulateBattle } from '../../src/domain/battleSimulation';
import { blueArmy, redArmy, singleCohortArmy } from '../fixtures';
import { materializeBattle } from '../materializeBattle';

describe('battle scaling and compatibility', () => {
  it('rejects battles beyond the measured 4000-unit resource envelope', () => {
    expect(() =>
      simulateBattle(
        singleCohortArmy('left', 'infantry', 'recruit', 2001),
        singleCohortArmy('right', 'infantry', 'recruit', 2000),
        12,
        { maxTicks: 1 },
      ),
    ).toThrowError(expect.objectContaining({ code: 'invalid-deployment' }));
  });
  it('preserves exact cooldown ticks and ceiling behavior when skipping inert ticks', () => {
    const left = singleCohortArmy('left', 'infantry', 'recruit', 1);
    const right = singleCohortArmy('right', 'infantry', 'recruit', 1);
    const result = simulateBattle(left, right, 12, { maxTicks: 1600 });
    expect(result.durationTicks).toBe(1600);
    expect(result.events.at(-1)).toEqual({
      type: 'battle-ended',
      tick: 1600,
      outcome: 'draw',
      winner: null,
    });
    expect(() =>
      simulateBattle(left, right, 12, { maxTicks: 1599 }),
    ).toThrowError(expect.objectContaining({ code: 'stalemate', tick: 1599 }));
  });
  it('preserves the pre-optimization complete fixture results', () => {
    const hash = createHash('sha256')
      .update(
        JSON.stringify(
          materializeBattle(simulateBattle(blueArmy(), redArmy(), 41721)),
        ),
      )
      .digest('hex');
    expect(hash).toBe(
      'a32a5b4c9dbc9dbf6e3bc789ccaf677a3ceb03656784f4a4976edf7ce5f03e3a',
    );
  });

  it('indexes 2000-vs-2000 approach ticks within a generous CI budget', () => {
    const start = performance.now();
    expect(() =>
      simulateBattle(
        singleCohortArmy('left', 'infantry', 'recruit', 2000),
        singleCohortArmy('right', 'infantry', 'recruit', 2000),
        12,
        { maxTicks: 100 },
      ),
    ).toThrowError(expect.objectContaining({ code: 'stalemate' }));
    expect(performance.now() - start).toBeLessThan(2000);
  }, 15_000);

  it('completes a full 2000-vs-2000 battle within runtime and memory budgets', () => {
    const before = process.memoryUsage();
    const start = performance.now();
    const result = simulateBattle(
      singleCohortArmy('left', 'infantry', 'recruit', 2000),
      singleCohortArmy('right', 'infantry', 'recruit', 2000),
      12,
    );
    const elapsedMs = performance.now() - start;
    const after = process.memoryUsage();
    const memoryGrowth =
      Math.max(0, after.heapUsed - before.heapUsed) +
      Math.max(0, after.arrayBuffers - before.arrayBuffers);
    console.info(
      JSON.stringify({
        benchmark: '2000v2000',
        elapsedMs,
        events: result.events.length,
        ticks: result.durationTicks,
        memoryGrowthMiB: memoryGrowth / 1024 ** 2,
        eventStorageMiB: result.events.byteLength / 1024 ** 2,
      }),
    );
    expect(result.outcome).toBe('draw');
    expect(result.events.at(-1)?.type).toBe('battle-ended');
    expect(result.events.length).toBeGreaterThan(4_000_000);
    expect(elapsedMs).toBeLessThan(15_000);
    expect(memoryGrowth).toBeLessThan(256 * 1024 ** 2);
    expect(result.events.byteLength).toBeLessThanOrEqual(
      (result.events.length + 4096) * 41,
    );
    expect(result.events.byteLength).toBeLessThan(110 * 1024 ** 2);
  }, 120_000);
});
