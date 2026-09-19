import { expect, it } from 'vitest';
import {
  acceptanceScenarios,
  formationDuel,
} from '../../src/game/acceptanceScenarios';
import { simulateBattle } from '../../src/domain/battleSimulation';
import { totalLivingUnits } from '../../src/domain/army';

it.each([
  ['equal-infantry', 'draw', null, 6620, 0, 0],
  ['veteran-line', 'victory', 'right', 2393, 0, 90],
  ['spear-and-bow', 'victory', 'right', 1646, 0, 40],
] as const)(
  'resolves the recorded %s acceptance army and seed',
  (id, outcome, winner, durationTicks, left, right) => {
    const preset = acceptanceScenarios.find((s) => s.id === id)!;
    const r = simulateBattle(preset.left, preset.right, preset.seed);
    expect([
      r.outcome,
      r.winner,
      r.durationTicks,
      totalLivingUnits(r.leftSurvivors),
      totalLivingUnits(r.rightSurvivors),
    ]).toEqual([outcome, winner, durationTicks, left, right]);
    expect(preset.expected).toEqual({
      outcome,
      winner,
      durationTicks,
      leftSurvivors: left,
      rightSurvivors: right,
    });
  },
);
it('changing only archer formation changes the winner with the same army and seed', () => {
  const rear = formationDuel('rear'),
    front = formationDuel('front');
  const a = simulateBattle(rear.left, rear.right, rear.seed),
    b = simulateBattle(front.left, front.right, front.seed);
  expect([
    a.winner,
    totalLivingUnits(a.leftSurvivors),
    a.durationTicks,
  ]).toEqual(['left', 1, 1897]);
  expect([
    b.winner,
    totalLivingUnits(b.rightSurvivors),
    b.durationTicks,
  ]).toEqual(['right', 1, 2132]);
});
