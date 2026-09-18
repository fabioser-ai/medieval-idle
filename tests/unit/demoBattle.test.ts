import { expect, it } from 'vitest';
import { demoArmies } from '../../src/game/demoBattle';
import { BattleSession } from '../../src/application/battleSession';
import { BattlePlayback } from '../../src/game/BattlePlayback';
import { totalLivingUnits, validateDeployment } from '../../src/domain/army';

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
