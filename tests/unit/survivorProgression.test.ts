import { describe, expect, it } from 'vitest';
import {
  cloneDeployment,
  validateDeployment,
  type ArmyDeployment,
  type UnitCohort,
} from '../../src/domain/army';
import {
  simulateBattle,
  type BattleResult,
} from '../../src/domain/battleSimulation';
import { BattleEventLogBuilder } from '../../src/domain/battleEventLog';
import { applySurvivorProgression } from '../../src/domain/survivorProgression';

function army(
  cohorts: readonly UnitCohort[],
  side: 'left' | 'right' = 'left',
): ArmyDeployment {
  return { kingdom: side, side, groups: [{ slot: 'front', cohorts }] };
}
function result(
  cohorts: readonly UnitCohort[],
  winner: 'left' | 'right' | null = 'left',
): BattleResult {
  return {
    winner,
    outcome: winner === null ? 'draw' : 'victory',
    leftSurvivors: army(cohorts),
    rightSurvivors: army(cohorts, 'right'),
    seed: 1,
    durationTicks: 1,
    initialUnits: [],
    events: new BattleEventLogBuilder().finish(),
  };
}

describe('survivor progression', () => {
  it('saturates an exhausted safe-integer history without making saved metadata invalid', () => {
    const battle = result([
      {
        type: 'infantry',
        tier: 'elite',
        count: 1,
        survivedVictories: Number.MAX_SAFE_INTEGER,
      },
    ]);
    expect(
      applySurvivorProgression(battle, 'left').groups[0].cohorts[0]
        .survivedVictories,
    ).toBe(Number.MAX_SAFE_INTEGER);
  });
  it('removes deaths and promotes a recruit after one survived victory without mutating its result', () => {
    const battle = result([
      { type: 'infantry', tier: 'recruit', count: 1 },
      { type: 'archer', tier: 'elite', count: 0 },
    ]);
    expect(applySurvivorProgression(battle, 'left').groups[0].cohorts).toEqual([
      { type: 'infantry', tier: 'trained', count: 1, survivedVictories: 1 },
    ]);
    expect(battle.leftSurvivors.groups[0].cohorts[0].tier).toBe('recruit');
  });
  it.each([
    [0, 'trained'],
    [1, 'trained'],
    [2, 'veteran'],
    [5, 'veteran'],
    [6, 'elite'],
    [7, 'elite'],
  ] as const)(
    'promotes at the exact threshold after %i previous victories',
    (wins, tier) => {
      const battle = result([
        {
          type: 'infantry',
          tier: 'recruit',
          count: 2,
          survivedVictories: wins,
        },
      ]);
      expect(
        applySurvivorProgression(battle, 'left').groups[0].cohorts[0],
      ).toEqual({
        type: 'infantry',
        tier,
        count: 2,
        survivedVictories: wins + 1,
      });
    },
  );
  it.each([null, 'right'] as const)(
    'does not award victories or change tiers on a draw/loss (%s)',
    (winner) => {
      const battle = result(
        [{ type: 'archer', tier: 'trained', count: 1, survivedVictories: 2 }],
        winner,
      );
      expect(
        applySurvivorProgression(battle, 'left').groups[0].cohorts[0],
      ).toEqual({
        type: 'archer',
        tier: 'trained',
        count: 1,
        survivedVictories: 2,
      });
    },
  );
  it('handles right-side victories and never demotes trained units with no victory history', () => {
    const battle = result(
      [{ type: 'cavalry', tier: 'elite', count: 1 }],
      'right',
    );
    expect(
      applySurvivorProgression(battle, 'right').groups[0].cohorts[0],
    ).toEqual({
      type: 'cavalry',
      tier: 'elite',
      count: 1,
      survivedVictories: 1,
    });
  });
  it('preserves distinct histories through clone, simulation, progression, and a second battle', () => {
    const left = army([
      { type: 'infantry', tier: 'elite', count: 5, survivedVictories: 2 },
      { type: 'infantry', tier: 'elite', count: 5, survivedVictories: 6 },
    ]);
    const right = army(
      [{ type: 'infantry', tier: 'recruit', count: 1 }],
      'right',
    );
    expect(
      cloneDeployment(left).groups[0].cohorts.map((c) => c.survivedVictories),
    ).toEqual([2, 6]);
    const first = simulateBattle(left, right, 12);
    expect(
      first.initialUnits.slice(0, 10).map((u) => u.survivedVictories),
    ).toEqual([2, 2, 2, 2, 2, 6, 6, 6, 6, 6]);
    const progressed = applySurvivorProgression(first, 'left');
    expect(
      progressed.groups[0].cohorts.map((c) => c.survivedVictories),
    ).toEqual([3, 7]);
    const second = applySurvivorProgression(
      simulateBattle(progressed, right, 12),
      'left',
    );
    expect(second.groups[0].cohorts.map((c) => c.survivedVictories)).toEqual([
      4, 8,
    ]);
  });
  it.each([-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, '1', null])(
    'rejects malformed victory metadata %s',
    (survivedVictories) => {
      const invalid = army([
        {
          type: 'infantry',
          tier: 'recruit',
          count: 1,
          survivedVictories,
        } as UnitCohort,
      ]);
      expect(validateDeployment(invalid)).toContain(
        'Survived victories must be a nonnegative safe integer.',
      );
    },
  );
});
