import {
  cloneDeployment,
  type ArmyDeployment,
  type FormationSlot,
  type UnitCohort,
} from '../domain/army';
import type { LastResultSummary } from '../application/saveStore';
export interface AcceptanceScenario {
  id: string;
  label: string;
  seed: number;
  left: ArmyDeployment;
  right: ArmyDeployment;
  expected: LastResultSummary;
}
const army = (side: 'left' | 'right', cohorts: UnitCohort[]): ArmyDeployment =>
  cloneDeployment({
    kingdom: side === 'left' ? 'Alderwatch' : 'Emberfall',
    side,
    groups: cohorts.map((cohort, i) => ({
      slot: i === 0 ? 'front' : 'rear',
      cohorts: [cohort],
    })),
  });
export const acceptanceScenarios: readonly AcceptanceScenario[] = [
  {
    id: 'equal-infantry',
    label: '1 · 100 recruit infantry vs 100 recruit infantry',
    seed: 626,
    left: army('left', [{ type: 'infantry', tier: 'recruit', count: 100 }]),
    right: army('right', [{ type: 'infantry', tier: 'recruit', count: 100 }]),
    expected: {
      outcome: 'draw',
      winner: null,
      durationTicks: 6620,
      leftSurvivors: 0,
      rightSurvivors: 0,
    },
  },
  {
    id: 'veteran-line',
    label:
      '2 · 60 veteran infantry + 30 trained archers vs 150 recruit infantry',
    seed: 626,
    left: army('left', [
      { type: 'infantry', tier: 'veteran', count: 60 },
      { type: 'archer', tier: 'trained', count: 30 },
    ]),
    right: army('right', [{ type: 'infantry', tier: 'recruit', count: 150 }]),
    expected: {
      outcome: 'victory',
      winner: 'right',
      durationTicks: 2393,
      leftSurvivors: 0,
      rightSurvivors: 90,
    },
  },
  {
    id: 'spear-and-bow',
    label:
      '3 · 40 recruit spearmen + 20 veteran archers vs 35 trained cavalry + 40 recruit infantry',
    seed: 626,
    left: army('left', [
      { type: 'spearman', tier: 'recruit', count: 40 },
      { type: 'archer', tier: 'veteran', count: 20 },
    ]),
    right: army('right', [
      { type: 'cavalry', tier: 'trained', count: 35 },
      { type: 'infantry', tier: 'recruit', count: 40 },
    ]),
    expected: {
      outcome: 'victory',
      winner: 'right',
      durationTicks: 1646,
      leftSurvivors: 0,
      rightSurvivors: 40,
    },
  },
];
export function formationDuel(
  slot: Extract<FormationSlot, 'rear' | 'front'>,
): AcceptanceScenario {
  const rear = slot === 'rear';
  return {
    id: `archer-${slot}`,
    label: `Formation check · 5 trained archers (${slot}) vs 4 recruit infantry`,
    seed: 626,
    left: cloneDeployment({
      ...army('left', []),
      groups: [
        { slot, cohorts: [{ type: 'archer', tier: 'trained', count: 5 }] },
      ],
    }),
    right: army('right', [{ type: 'infantry', tier: 'recruit', count: 4 }]),
    expected: {
      outcome: 'victory',
      winner: rear ? 'left' : 'right',
      durationTicks: rear ? 1897 : 2132,
      leftSurvivors: rear ? 1 : 0,
      rightSurvivors: rear ? 0 : 1,
    },
  };
}
export const developerScenarios = [
  ...acceptanceScenarios,
  formationDuel('rear'),
  formationDuel('front'),
];
