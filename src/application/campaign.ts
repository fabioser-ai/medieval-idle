import {
  EXPERIENCE_TIERS,
  UNIT_TYPES,
  cloneDeployment,
  totalLivingUnits,
  type ArmyDeployment,
} from '../domain/army';
import type { BattleResult } from '../domain/battleEvents';
import { applySurvivorProgression } from '../domain/survivorProgression';
import type { Inventory } from '../ui/deployment';
import { SaveStore, type SaveData } from './saveStore';
const fresh = (): SaveData => ({
  schemaVersion: 1,
  kingdom: 'Alderwatch',
  availableCohorts: UNIT_TYPES.flatMap((type) =>
    EXPERIENCE_TIERS.map((tier, i) => ({
      type,
      tier,
      count: [12, 10, 6, 2][i],
      survivedVictories: 0,
    })),
  ),
  reservedTrainerCohorts: [],
  lastSeed: null,
  lastResult: null,
});

/** Campaign owns only roster/summary data, never the large replay event log. */
export class Campaign {
  data: SaveData;
  notice = '';
  private pending?: SaveData;
  constructor(private readonly store = new SaveStore()) {
    const loaded = store.load();
    this.data = 'data' in loaded ? loaded.data : fresh();
    if (loaded.status === 'corrupt-recovered')
      this.notice = 'Recovered the last valid backup.';
    if (loaded.status === 'corrupt')
      this.notice = 'Could not load a valid save. A fresh roster is available.';
  }
  get inventory(): Inventory {
    const inventory: Inventory = {};
    for (const c of this.data.availableCohorts) {
      const tiers = (inventory[c.type] ??= {});
      tiers[c.tier] = (tiers[c.tier] ?? 0) + c.count;
    }
    return inventory;
  }
  get depleted(): boolean {
    return this.data.availableCohorts.every((cohort) => cohort.count === 0);
  }
  /** Explicit new campaign, never resurrection or automatic loss recovery. */
  startNewCampaign(): void {
    if (!this.depleted || this.pending)
      throw new Error('Only a completed, depleted campaign can be replaced.');
    this.data = fresh();
    this.persist();
  }
  reset(army: ArmyDeployment): void {
    this.pending = undefined;
    this.data = {
      ...fresh(),
      kingdom: army.kingdom,
      availableCohorts: army.groups.flatMap((g) =>
        g.cohorts.map((c) => ({
          ...c,
          survivedVictories: c.survivedVictories ?? 0,
        })),
      ),
    };
    this.persist();
  }
  /** Split UI type/tier quantities back into their original victory histories. */
  deploy(request: ArmyDeployment): ArmyDeployment {
    if (totalLivingUnits(request) > 240)
      throw new RangeError('Prototype deployment limit is 240 soldiers.');
    const remaining = this.data.availableCohorts.map((c) => ({ ...c }));
    return cloneDeployment({
      ...request,
      kingdom: this.data.kingdom,
      groups: request.groups.map((g) => ({
        ...g,
        cohorts: g.cohorts.flatMap((wanted) => {
          let needed = wanted.count;
          const taken = [];
          for (const cohort of remaining) {
            if (
              cohort.type !== wanted.type ||
              cohort.tier !== wanted.tier ||
              !needed
            )
              continue;
            const count = Math.min(needed, cohort.count);
            if (!count) continue;
            taken.push({ ...cohort, count });
            cohort.count -= count;
            needed -= count;
          }
          if (needed)
            throw new RangeError('Deployment exceeds campaign inventory.');
          return taken;
        }),
      })),
    });
  }
  stage(result: BattleResult, deployed: ArmyDeployment): void {
    const reserve = this.data.availableCohorts.map((c) => ({ ...c }));
    for (const group of deployed.groups)
      for (const sent of group.cohorts) {
        let needed = sent.count;
        for (const cohort of reserve)
          if (
            cohort.type === sent.type &&
            cohort.tier === sent.tier &&
            cohort.survivedVictories === (sent.survivedVictories ?? 0)
          ) {
            const count = Math.min(needed, cohort.count);
            cohort.count -= count;
            needed -= count;
          }
        if (needed)
          throw new RangeError('Deployment exceeds campaign inventory.');
      }
    const survivors = applySurvivorProgression(result, 'left');
    this.pending = {
      ...this.data,
      availableCohorts: [
        ...reserve.filter((c) => c.count > 0),
        ...survivors.groups.flatMap((g) =>
          g.cohorts.map((c) => ({
            ...c,
            survivedVictories: c.survivedVictories ?? 0,
          })),
        ),
      ],
      lastSeed: result.seed,
      lastResult: {
        outcome: result.outcome,
        winner: result.winner,
        durationTicks: result.durationTicks,
        leftSurvivors: totalLivingUnits(result.leftSurvivors),
        rightSurvivors: totalLivingUnits(result.rightSurvivors),
      },
    };
  }
  finish(): void {
    if (!this.pending) return;
    this.data = this.pending;
    this.pending = undefined;
    this.persist();
  }
  private persist(): void {
    this.notice =
      this.store.save(this.data).status === 'saved'
        ? 'Campaign saved.'
        : 'Could not save this campaign. Progress is available only in this tab.';
  }
}
