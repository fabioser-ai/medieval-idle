import type { ArmyDeployment } from '../domain/army';
/** Deliberately small: maximum-size synchronous simulation is not UI-safe. */
export function demoArmies(): [ArmyDeployment, ArmyDeployment] {
  return [
    {
      kingdom: 'Alderwatch',
      side: 'left',
      groups: [
        {
          slot: 'front',
          cohorts: [{ type: 'infantry', tier: 'trained', count: 16 }],
        },
        {
          slot: 'middle',
          cohorts: [{ type: 'spearman', tier: 'recruit', count: 8 }],
        },
        {
          slot: 'rear',
          cohorts: [{ type: 'archer', tier: 'trained', count: 10 }],
        },
        {
          slot: 'left-flank',
          cohorts: [{ type: 'cavalry', tier: 'recruit', count: 6 }],
        },
      ],
    },
    {
      kingdom: 'Emberfall',
      side: 'right',
      groups: [
        {
          slot: 'front',
          cohorts: [{ type: 'spearman', tier: 'trained', count: 18 }],
        },
        {
          slot: 'middle',
          cohorts: [{ type: 'infantry', tier: 'recruit', count: 10 }],
        },
        {
          slot: 'rear',
          cohorts: [{ type: 'archer', tier: 'recruit', count: 8 }],
        },
        {
          slot: 'right-flank',
          cohorts: [{ type: 'cavalry', tier: 'trained', count: 6 }],
        },
      ],
    },
  ];
}
