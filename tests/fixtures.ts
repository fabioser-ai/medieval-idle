import type {
  ArmyDeployment,
  ArmySide,
  ExperienceTier,
  UnitType,
} from '../src/domain/army';

export function singleCohortArmy(
  side: ArmySide,
  type: UnitType,
  tier: ExperienceTier,
  count: number,
): ArmyDeployment {
  return {
    kingdom: side === 'left' ? 'Left Kingdom' : 'Right Kingdom',
    side,
    groups: [
      {
        slot: 'front',
        cohorts: [{ type, tier, count }],
      },
    ],
  };
}

export function blueArmy(): ArmyDeployment {
  return {
    kingdom: 'Blue Kingdom',
    side: 'left',
    groups: [
      {
        slot: 'front',
        cohorts: [
          { type: 'infantry', tier: 'recruit', count: 80 },
          { type: 'infantry', tier: 'veteran', count: 20 },
        ],
      },
      {
        slot: 'rear',
        cohorts: [{ type: 'archer', tier: 'trained', count: 30 }],
      },
    ],
  };
}

export function redArmy(): ArmyDeployment {
  return {
    kingdom: 'Red Kingdom',
    side: 'right',
    groups: [
      {
        slot: 'front',
        cohorts: [{ type: 'spearman', tier: 'recruit', count: 40 }],
      },
      {
        slot: 'right-flank',
        cohorts: [{ type: 'cavalry', tier: 'trained', count: 20 }],
      },
    ],
  };
}
