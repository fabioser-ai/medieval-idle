import { describe, expect, it } from 'vitest';

import {
  cloneDeployment,
  getCount,
  totalLivingUnits,
  validateDeployment,
  type ArmyDeployment,
} from '../../src/domain/army';
import { blueArmy, redArmy, singleCohortArmy } from '../fixtures';

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

  it('accepts all valid values and permits empty formation slots', () => {
    const army = redArmy();

    expect(validateDeployment(army)).toEqual([]);
  });

  it('clones nested deployment data so source edits do not affect the clone', () => {
    const source = singleCohortArmy('left', 'infantry', 'recruit', 12);
    const clone = cloneDeployment(source);

    const mutableSource = source as unknown as {
      kingdom: string;
      groups: Array<{ slot: string; cohorts: Array<{ count: number }> }>;
    };
    mutableSource.kingdom = 'Changed';
    mutableSource.groups[0].cohorts[0].count = 0;
    mutableSource.groups.push({ slot: 'rear', cohorts: [] });

    expect(clone.kingdom).toBe('Left Kingdom');
    expect(clone.groups).toHaveLength(1);
    expect(clone.groups[0].cohorts[0].count).toBe(12);
  });
});
