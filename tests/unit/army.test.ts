import { describe, expect, it } from 'vitest';

import {
  ARMY_SIDES,
  EXPERIENCE_TIERS,
  FORMATION_SLOTS,
  UNIT_TYPES,
  cloneDeployment,
  getCount,
  totalLivingUnits,
  validateDeployment,
  type ArmyDeployment,
} from '../../src/domain/army';
import { blueArmy, singleCohortArmy } from '../fixtures';

describe('army deployment domain', () => {
  it('rejects a negative cohort count', () => {
    const army = singleCohortArmy('left', 'infantry', 'recruit', -1);

    expect(validateDeployment(army)).toContain(
      'Cohort count cannot be negative.',
    );
  });

  it('counts units across tiers and slots', () => {
    const army = blueArmy();

    expect(totalLivingUnits(army)).toBe(130);
    expect(getCount(army, 'infantry', 'veteran')).toBe(20);
  });

  it('rejects invalid identity, values, duplicate slots, and empty armies', () => {
    const army = {
      kingdom: ' ',
      side: 'unknown',
      groups: [
        {
          slot: 'front',
          cohorts: [{ type: 'invalid', tier: 'recruit', count: 1.5 }],
        },
        {
          slot: 'front',
          cohorts: [{ type: 'infantry', tier: 'invalid', count: 0 }],
        },
      ],
    } as unknown as ArmyDeployment;

    expect(validateDeployment(army)).toEqual(
      expect.arrayContaining([
        'Kingdom name cannot be blank.',
        'Army side is invalid.',
        'Unit type is invalid.',
        'Experience tier is invalid.',
        'Cohort count must be an integer.',
        'Formation slots must be unique.',
      ]),
    );
  });

  it('rejects a deployment with zero living units', () => {
    const army = singleCohortArmy('left', 'infantry', 'recruit', 0);

    expect(validateDeployment(army)).toContain(
      'Deployment must contain at least one unit.',
    );
  });

  it('rejects malformed groups and cohorts instead of treating them as empty', () => {
    const malformedGroups = {
      kingdom: 'Malformed Kingdom',
      side: 'left',
      groups: { slot: 'front', cohorts: [] },
    } as unknown as ArmyDeployment;
    const malformedCohorts = {
      kingdom: 'Malformed Kingdom',
      side: 'left',
      groups: [
        {
          slot: 'front',
          cohorts: [{ type: 'infantry', tier: 'recruit', count: 1 }],
        },
        { slot: 'rear', cohorts: 'not-an-array' },
      ],
    } as unknown as ArmyDeployment;

    expect(validateDeployment(malformedGroups)).toContain(
      'Formation groups must be an array.',
    );
    expect(validateDeployment(malformedCohorts)).toContain(
      'Cohorts must be an array.',
    );
  });

  it('accepts every allowed literal on both sides and permits an empty slot', () => {
    const sides = ['left', 'right'] as const;
    const types = ['infantry', 'archer', 'spearman', 'cavalry'] as const;
    const tiers = ['recruit', 'trained', 'veteran', 'elite'] as const;
    const slots = [
      'front',
      'middle',
      'rear',
      'left-flank',
      'right-flank',
    ] as const;
    expect(ARMY_SIDES).toEqual(sides);
    expect(UNIT_TYPES).toEqual(types);
    expect(EXPERIENCE_TIERS).toEqual(tiers);
    expect(FORMATION_SLOTS).toEqual(slots);

    const armies = sides.map((side) => ({
      kingdom: `${side} Kingdom`,
      side,
      groups: [
        {
          slot: slots[0],
          cohorts: [{ type: types[0], tier: tiers[0], count: 1 }],
        },
        {
          slot: slots[1],
          cohorts: [{ type: types[1], tier: tiers[1], count: 1 }],
        },
        {
          slot: slots[2],
          cohorts: [{ type: types[2], tier: tiers[2], count: 1 }],
        },
        {
          slot: slots[3],
          cohorts: [{ type: types[3], tier: tiers[3], count: 1 }],
        },
        { slot: slots[4], cohorts: [] },
      ],
    }));

    expect(armies).toHaveLength(2);
    for (const army of armies) {
      expect(validateDeployment(army)).toEqual([]);
    }
  });

  it('clones nested deployment data so source edits do not affect the clone', () => {
    const source = blueArmy();
    const clone = cloneDeployment(source);

    const mutableSource = source as unknown as {
      kingdom: string;
      groups: Array<{ slot: string; cohorts: Array<{ count: number }> }>;
    };
    mutableSource.kingdom = 'Changed';
    mutableSource.groups[0].cohorts[0].count = 0;
    mutableSource.groups.push({ slot: 'rear', cohorts: [] });

    expect(clone.kingdom).toBe('Blue Kingdom');
    expect(clone.groups).toHaveLength(2);
    expect(clone.groups[0].cohorts[0].count).toBe(80);
    for (const group of clone.groups) {
      expect(Object.isFrozen(group)).toBe(true);
      expect(Object.isFrozen(group.cohorts)).toBe(true);
      for (const cohort of group.cohorts) {
        expect(Object.isFrozen(cohort)).toBe(true);
      }
    }
    expect(Object.isFrozen(clone)).toBe(true);
    expect(Object.isFrozen(clone.groups)).toBe(true);
  });

  it('freezes exported value tables so validation cannot be changed at runtime', () => {
    expect(Object.isFrozen(UNIT_TYPES)).toBe(true);
    expect(Object.isFrozen(EXPERIENCE_TIERS)).toBe(true);
    expect(Object.isFrozen(FORMATION_SLOTS)).toBe(true);
    expect(Object.isFrozen(ARMY_SIDES)).toBe(true);
  });
});
