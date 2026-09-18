import { describe, expect, it } from 'vitest';
import type { ArmyDeployment } from '../../src/domain/army';
import { totalLivingUnits } from '../../src/domain/army';
import type { BattleEvent } from '../../src/domain/battleEvents';
import { simulateBattle } from '../../src/domain/battleSimulation';
import { blueArmy, redArmy, singleCohortArmy } from '../fixtures';

const duel = (seed = 12) =>
  simulateBattle(
    singleCohortArmy('left', 'infantry', 'recruit', 1),
    singleCohortArmy('right', 'infantry', 'recruit', 1),
    seed,
  );

function eventsOf<T extends BattleEvent['type']>(
  events: readonly BattleEvent[],
  type: T,
) {
  return events.filter(
    (event): event is Extract<BattleEvent, { type: T }> => event.type === type,
  );
}

function expectFrozenDeep(value: unknown): void {
  if (value === null || typeof value !== 'object') return;
  expect(Object.isFrozen(value)).toBe(true);
  for (const child of Object.values(value)) expectFrozenDeep(child);
}

describe('deterministic battle simulation', () => {
  it('consumes the known PRNG sequence only for attacks in stable ID order', () => {
    const attacks = eventsOf(duel(41721).events, 'attack').slice(0, 4);
    expect(attacks.map((attack) => attack.attackerId)).toEqual([1, 2, 1, 2]);
    const expected = [
      0.9660809408407659, 1.0741994185838848, 0.9989418623037637,
      1.0658789122942836,
    ];
    attacks.forEach((attack, index) =>
      expect(attack.randomFactor).toBeCloseTo(expected[index], 14),
    );
  });

  it('prefers a nearer high-ID cavalry target to a farther low-ID archer', () => {
    const result = simulateBattle(
      singleCohortArmy('left', 'archer', 'elite', 1),
      {
        kingdom: 'Right Kingdom',
        side: 'right',
        groups: [
          {
            slot: 'front',
            cohorts: [
              { type: 'archer', tier: 'recruit', count: 1 },
              { type: 'cavalry', tier: 'recruit', count: 1 },
            ],
          },
        ],
      },
      12,
    );
    expect(
      eventsOf(result.events, 'attack').find(
        (attack) => attack.attackerId === 1,
      )?.targetId,
    ).toBe(3);
  });

  it('replays the same complete event log for identical input and seed', () => {
    expect(simulateBattle(blueArmy(), redArmy(), 41721)).toEqual(
      simulateBattle(blueArmy(), redArmy(), 41721),
    );
  });

  it('uses the seed for stable attacker-ordered random draws', () => {
    const first = duel(41721);
    const second = duel(12);
    expect(
      eventsOf(first.events, 'attack').map((event) => event.randomFactor),
    ).not.toEqual(
      eventsOf(second.events, 'attack').map((event) => event.randomFactor),
    );
    for (const attack of eventsOf(first.events, 'attack')) {
      expect(attack.randomFactor).toBeGreaterThanOrEqual(0.9);
      expect(attack.randomFactor).toBeLessThanOrEqual(1.1);
    }
    expect(first.seed).toBe(41721);
  });

  it('does not mutate or freeze caller-owned deployments and deeply freezes its result', () => {
    const left = blueArmy();
    const right = redArmy();
    const before = structuredClone({ left, right });
    const result = simulateBattle(left, right, 12);
    expect({ left, right }).toEqual(before);
    expect(Object.isFrozen(left)).toBe(false);
    expect(Object.isFrozen(left.groups)).toBe(false);
    expect(result.leftSurvivors).not.toBe(left);
    expectFrozenDeep(result);
  });

  it('orders gate, march, charge, attacks, deaths and terminal events by tick and phase', () => {
    const result = duel();
    expect(
      result.events
        .slice(0, 4)
        .map((event) => [event.type, 'side' in event ? event.side : null]),
    ).toEqual([
      ['gate-opened', 'left'],
      ['gate-opened', 'right'],
      ['march-started', 'left'],
      ['march-started', 'right'],
    ]);
    const rank = {
      'gate-opened': 0,
      'march-started': 1,
      'charge-started': 2,
      attack: 3,
      death: 4,
      'battle-ended': 5,
    };
    for (let index = 1; index < result.events.length; index += 1) {
      const previous = result.events[index - 1];
      const event = result.events[index];
      expect(event.tick).toBeGreaterThanOrEqual(previous.tick);
      if (event.tick === previous.tick)
        expect(rank[event.type]).toBeGreaterThanOrEqual(rank[previous.type]);
      if (
        event.type === 'attack' &&
        previous.type === 'attack' &&
        event.tick === previous.tick
      )
        expect(event.attackerId).toBeGreaterThan(previous.attackerId);
    }
    expect(result.events.at(-1)).toEqual({
      type: 'battle-ended',
      tick: result.durationTicks,
      outcome: 'draw',
      winner: null,
    });
    expect(eventsOf(result.events, 'battle-ended')).toHaveLength(1);
  });

  it('marches at 60% speed and charges only once per unit when distance reaches .28', () => {
    const result = simulateBattle(
      singleCohortArmy('left', 'cavalry', 'recruit', 1),
      singleCohortArmy('right', 'cavalry', 'recruit', 1),
      1,
    );
    expect(
      result.initialUnits.map(({ id, position }) => ({ id, position })),
    ).toEqual([
      { id: 1, position: -1 },
      { id: 2, position: 1 },
    ]);
    const charges = eventsOf(result.events, 'charge-started');
    expect(charges).toHaveLength(2);
    // 383 marching steps at 1.5 * .05 / 20 * .6 = .00225 per unit.
    expect(charges[0].tick).toBe(384);
    expect(charges[0].position).toBeCloseTo(-0.13825, 10);
    expect(charges[1].position).toBeCloseTo(0.13825, 10);
    expect(charges[0].distance).toBeCloseTo(0.2765, 10);
    expect(charges[0].distance + 0.0045).toBeGreaterThan(0.28);
    // Full-speed charge closes remaining distance in 31 steps.
    const firstAttack = eventsOf(result.events, 'attack')[0];
    expect(firstAttack.tick).toBe(414);
    expect(
      Math.abs(firstAttack.attackerPosition - firstAttack.targetPosition),
    ).toBeLessThanOrEqual(0.05);
  });

  it('lets ranged units shoot earlier and stop at their normalized range', () => {
    const result = simulateBattle(
      singleCohortArmy('left', 'archer', 'recruit', 1),
      singleCohortArmy('right', 'infantry', 'recruit', 1),
      12,
    );
    const attacks = eventsOf(result.events, 'attack');
    const ranged = attacks.filter((attack) => attack.attackerId === 1);
    const melee = attacks.filter((attack) => attack.attackerId === 2);
    expect(ranged[0].tick).toBeLessThan(melee[0].tick);
    expect(
      Math.abs(ranged[0].attackerPosition - ranged[0].targetPosition),
    ).toBeLessThanOrEqual(0.25);
    expect(
      Math.abs(ranged[0].attackerPosition - ranged[0].targetPosition),
    ).toBeGreaterThan(0.05);
    expect(
      ranged.every(
        (attack) => attack.attackerPosition === ranged[0].attackerPosition,
      ),
    ).toBe(true);
    expect(ranged[1].tick - ranged[0].tick).toBe(24);
    for (const attack of attacks) {
      expect(attack.attackerPosition).toBeGreaterThanOrEqual(-1);
      expect(attack.attackerPosition).toBeLessThanOrEqual(1);
    }
  });

  it('breaks equal-distance target ties by stable ID and retargets only living units', () => {
    const result = simulateBattle(
      singleCohortArmy('left', 'infantry', 'elite', 4),
      singleCohortArmy('right', 'infantry', 'recruit', 2),
      12,
    );
    const attacks = eventsOf(result.events, 'attack');
    expect(
      attacks
        .slice(0, 6)
        .map(({ attackerId, targetId }) => [attackerId, targetId]),
    ).toEqual([
      [1, 5],
      [2, 5],
      [3, 5],
      [4, 5],
      [5, 1],
      [6, 1],
    ]);
    const deaths = new Map(
      eventsOf(result.events, 'death').map((event) => [
        event.unitId,
        event.tick,
      ]),
    );
    for (const attack of attacks) {
      expect(deaths.get(attack.attackerId) ?? Infinity).toBeGreaterThanOrEqual(
        attack.tick,
      );
      expect(deaths.get(attack.targetId) ?? Infinity).toBeGreaterThanOrEqual(
        attack.tick,
      );
    }
    expect(
      attacks.some(
        (attack) => attack.attackerId === 1 && attack.targetId === 6,
      ),
    ).toBe(true);
  });

  it('applies all scheduled damage before deaths, including a simultaneous last-unit draw', () => {
    const result = duel();
    expect(result.outcome).toBe('draw');
    expect(result.winner).toBeNull();
    expect(totalLivingUnits(result.leftSurvivors)).toBe(0);
    expect(totalLivingUnits(result.rightSurvivors)).toBe(0);
    expect(
      result.events
        .filter((event) => event.tick === result.durationTicks)
        .map((event) => event.type),
    ).toEqual(['attack', 'attack', 'death', 'death', 'battle-ended']);
    expect(eventsOf(result.events, 'attack')).toHaveLength(100);
    expect(
      eventsOf(result.events, 'death').map((event) => event.unitId),
    ).toEqual([1, 2]);
  });

  it.each(['left', 'right'] as const)(
    'preserves survivor type, tier, slot and kingdom for a %s victory',
    (winner) => {
      const left = singleCohortArmy(
        'left',
        'infantry',
        winner === 'left' ? 'elite' : 'recruit',
        winner === 'left' ? 4 : 1,
      );
      const right = singleCohortArmy(
        'right',
        'infantry',
        winner === 'right' ? 'elite' : 'recruit',
        winner === 'right' ? 4 : 1,
      );
      const result = simulateBattle(left, right, 12);
      expect(result.outcome).toBe('victory');
      expect(result.winner).toBe(winner);
      expect(
        winner === 'left' ? result.leftSurvivors : result.rightSurvivors,
      ).toEqual(winner === 'left' ? left : right);
      expect(
        totalLivingUnits(
          winner === 'left' ? result.rightSurvivors : result.leftSurvivors,
        ),
      ).toBe(0);
    },
  );

  it('terminates the 190-unit fixtures with at most one living side and consistent survivor counts', () => {
    const result = simulateBattle(blueArmy(), redArmy(), 12);
    const leftAlive = totalLivingUnits(result.leftSurvivors);
    const rightAlive = totalLivingUnits(result.rightSurvivors);
    expect(leftAlive === 0 || rightAlive === 0).toBe(true);
    expect(
      leftAlive + rightAlive + eventsOf(result.events, 'death').length,
    ).toBe(190);
    expect(result.durationTicks).toBeLessThan(100_000);
  });

  it.each([
    { ...blueArmy(), groups: [] },
    { ...blueArmy(), side: 'right' },
    singleCohortArmy('left', 'infantry', 'recruit', -1),
    singleCohortArmy('left', 'infantry', 'recruit', 1.5),
    singleCohortArmy('left', 'infantry', 'recruit', 100_001),
    null,
  ])(
    'rejects invalid or empty left deployments before simulation (%#)',
    (left) => {
      expect(() =>
        simulateBattle(left as ArmyDeployment, redArmy(), 12),
      ).toThrowError(expect.objectContaining({ code: 'invalid-deployment' }));
    },
  );

  it('rejects empty right deployments and mismatched right side', () => {
    expect(() =>
      simulateBattle(blueArmy(), { ...redArmy(), groups: [] }, 12),
    ).toThrowError(expect.objectContaining({ code: 'invalid-deployment' }));
    expect(() =>
      simulateBattle(blueArmy(), { ...redArmy(), side: 'left' }, 12),
    ).toThrowError(expect.objectContaining({ code: 'invalid-deployment' }));
  });

  it.each([NaN, Infinity, 1.5, Number.MAX_SAFE_INTEGER + 1])(
    'rejects non-safe-integer seed %s',
    (seed) => {
      expect(() => simulateBattle(blueArmy(), redArmy(), seed)).toThrowError(
        expect.objectContaining({ code: 'invalid-seed' }),
      );
    },
  );

  it.each([0, -1, 1.5, Infinity, 100_001])(
    'rejects invalid tick ceilings %s',
    (maxTicks) => {
      expect(() =>
        simulateBattle(blueArmy(), redArmy(), 12, { maxTicks }),
      ).toThrowError(expect.objectContaining({ code: 'invalid-options' }));
    },
  );

  it('throws an explicit deterministic stalemate at the ceiling, never a fabricated winner', () => {
    for (let run = 0; run < 2; run += 1)
      expect(() =>
        simulateBattle(blueArmy(), redArmy(), 12, { maxTicks: 1 }),
      ).toThrowError(
        expect.objectContaining({
          name: 'BattleSimulationError',
          code: 'stalemate',
          tick: 1,
        }),
      );
  });

  it('rejects malformed runtime options instead of silently selecting defaults', () => {
    const left = blueArmy();
    const right = redArmy();
    for (const options of [null, [], { maxTicks: null }]) {
      expect(() =>
        simulateBattle(left, right, 12, options as never),
      ).toThrowError(expect.objectContaining({ code: 'invalid-options' }));
    }
  });
});
