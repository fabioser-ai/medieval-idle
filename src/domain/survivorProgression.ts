import {
  EXPERIENCE_TIERS,
  cloneDeployment,
  type ArmyDeployment,
  type ArmySide,
} from './army';
import type { BattleResult } from './battleEvents';

/** Pure: consume raw simulation survivors once per result, not an already progressed army. */
export function applySurvivorProgression(
  result: BattleResult,
  side: ArmySide,
): ArmyDeployment {
  const survivors =
    side === 'left' ? result.leftSurvivors : result.rightSurvivors;
  const won = result.outcome === 'victory' && result.winner === side;
  return cloneDeployment({
    ...survivors,
    groups: survivors.groups.map((group) => ({
      slot: group.slot,
      // Never merge cohorts: equal type/tier does not imply equal victory history.
      cohorts: group.cohorts
        .filter((cohort) => cohort.count > 0)
        .map((cohort) => {
          const victories = cohort.survivedVictories ?? 0;
          const survivedVictories = won
            ? Math.min(Number.MAX_SAFE_INTEGER, victories + 1)
            : victories;
          const earnedTier =
            survivedVictories >= 7
              ? 3
              : survivedVictories >= 3
                ? 2
                : survivedVictories >= 1
                  ? 1
                  : 0;
          const tier = won
            ? EXPERIENCE_TIERS[
                Math.max(EXPERIENCE_TIERS.indexOf(cohort.tier), earnedTier)
              ]
            : cohort.tier;
          return { ...cohort, tier, survivedVictories };
        }),
    })),
  });
}
