import { expect, it, vi } from 'vitest';
import { simulateBattle } from '../../src/domain/battleSimulation';
import { EXPERIENCE_TIERS, UNIT_TYPES } from '../../src/domain/army';
import type { ArmyDeployment, ArmySide } from '../../src/domain/army';
import { singleCohortArmy } from '../fixtures';
import { materializeBattle } from '../materializeBattle';

it('matches complete randomized battle outcomes and logs with a brute-force target oracle', async () => {
  vi.resetModules();
  vi.doMock('../../src/domain/targetIndex', () => ({
    createTargetIndex: (
      targets: readonly { id: number; position: number }[],
    ) => {
      const snapshot = targets.map((unit) => ({
        unit,
        position: unit.position,
      }));
      return {
        nearest(position: number) {
          let best = snapshot[0];
          for (const candidate of snapshot) {
            const distance = Math.abs(candidate.position - position);
            const bestDistance = Math.abs(best.position - position);
            if (
              distance < bestDistance ||
              (distance === bestDistance && candidate.unit.id < best.unit.id)
            )
              best = candidate;
          }
          return best.unit;
        },
      };
    },
  }));
  try {
    const { simulateBattle: reference } =
      await import('../../src/domain/battleSimulation');
    let state = 99019;
    const random = () => {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return state;
    };
    const army = (side: ArmySide): ArmyDeployment => ({
      kingdom: side,
      side,
      groups: [
        {
          slot: 'front',
          cohorts: Array.from({ length: 3 }, () => ({
            type: UNIT_TYPES[random() % 4],
            tier: EXPERIENCE_TIERS[random() % 4],
            count: 1 + (random() % 3),
          })),
        },
      ],
    });
    for (let trial = 0; trial < 30; trial += 1) {
      const left = army('left');
      const right = army('right');
      const seed = random();
      expect(materializeBattle(simulateBattle(left, right, seed))).toEqual(
        materializeBattle(reference(left, right, seed)),
      );
    }
  } finally {
    vi.doUnmock('../../src/domain/targetIndex');
    vi.resetModules();
  }
});

it.each([
  [0, 0],
  [2 ** 32 - 1, 2 ** 32 - 1],
  [2 ** 32, 0],
  [2 ** 32 + 1, 1],
  [-1, 2 ** 32 - 1],
  [-(2 ** 32), 0],
  [-(2 ** 32) - 1, 2 ** 32 - 1],
  [Number.MAX_SAFE_INTEGER, 2 ** 32 - 1],
  [Number.MIN_SAFE_INTEGER, 1],
] as const)(
  'normalizes seed %s to low-32-bit seed %s while preserving its original record',
  (seed, normalizedSeed) => {
    const left = singleCohortArmy('left', 'cavalry', 'trained', 2);
    const right = singleCohortArmy('right', 'spearman', 'recruit', 2);
    const result = simulateBattle(left, right, seed);
    expect(result.seed).toBe(seed);
    expect(materializeBattle(result)).toEqual({
      ...materializeBattle(simulateBattle(left, right, normalizedSeed)),
      seed,
    });
  },
);

it('preserves +2^32 seed equivalence without normalizing the recorded seed', () => {
  const left = singleCohortArmy('left', 'archer', 'trained', 2);
  const right = singleCohortArmy('right', 'infantry', 'veteran', 2);
  expect(
    materializeBattle(simulateBattle(left, right, 41721 + 2 ** 32)),
  ).toEqual({
    ...materializeBattle(simulateBattle(left, right, 41721)),
    seed: 41721 + 2 ** 32,
  });
});
