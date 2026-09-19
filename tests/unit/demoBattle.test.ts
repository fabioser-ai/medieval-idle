import { expect, it } from 'vitest';
import { demoArmies } from '../../src/game/demoBattle';
import { BattleSession } from '../../src/application/battleSession';
import { BattlePlayback } from '../../src/game/BattlePlayback';
import { totalLivingUnits, validateDeployment } from '../../src/domain/army';

it('keeps real seed626 pursuit continuous after attacks instead of snapping to later anchors', () => {
  const [left, right] = demoArmies();
  const result = new BattleSession().start(left, right, 626);
  const playback = new BattlePlayback();
  playback.load(result);
  let maxStep = 0;
  let movedAfterAttack = false;
  while (playback.phase !== 'result') {
    const before = playback.units.map((u) => ({
      position: u.position,
      attacked: u.attackUntil > 0,
    }));
    playback.advance(50, 1);
    for (const unit of playback.units) {
      if (unit.dying) continue;
      const step = Math.abs(unit.position - before[unit.id].position);
      maxStep = Math.max(maxStep, step);
      if (before[unit.id].attacked && step > 0) movedAfterAttack = true;
    }
  }
  // Fastest unit: 1.5 speed × .05 distance scale × .05 seconds.
  expect(maxStep).toBeLessThanOrEqual(0.003750001);
  expect(movedAfterAttack).toBe(true);
  expect(playback.counts.left).toBe(totalLivingUnits(result.leftSurvivors));
  expect(playback.counts.right).toBe(totalLivingUnits(result.rightSurvivors));
});

it('boots a small representative battle and streams the real session result to completion', () => {
  const [left, right] = demoArmies();
  expect(validateDeployment(left)).toEqual([]);
  expect(validateDeployment(right)).toEqual([]);
  expect(totalLivingUnits(left)).toBeLessThanOrEqual(48);
  expect(totalLivingUnits(right)).toBeLessThanOrEqual(48);
  const types = new Set(
    [...left.groups, ...right.groups].flatMap((g) =>
      g.cohorts.map((c) => c.type),
    ),
  );
  expect(types.size).toBe(4);
  const session = new BattleSession();
  const result = session.start(left, right, 626);
  const playback = new BattlePlayback();
  playback.load(result);
  while (playback.phase !== 'result') playback.advance(50, 4);
  expect(playback.counts.left).toBe(totalLivingUnits(result.leftSurvivors));
  expect(playback.counts.right).toBe(totalLivingUnits(result.rightSurvivors));
  expect(playback.winner).toBe(result.winner);
  expect(playback.eventCount).toBe(0);
});
