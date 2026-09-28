import type {
  BattleEvent,
  BattleEventLog,
  BattleUnitSnapshot,
} from '../domain/battleEvents';
import type { FormationSlot } from '../domain/army';
export interface VisualCohort {
  id: number;
  unit: BattleUnitSnapshot;
  unitIds: number[];
  aliveCount: number;
}
export const VISIBLE_PER_SIDE = 400;

/** Visual cohorts ignore progression history, which does not change a silhouette.
 * Largest-remainder allocation with a one-view floor preserves rare classes.
 * Membership is assigned once; deaths never reshuffle surviving unit IDs. */
export function aggregateUnits(units: readonly BattleUnitSnapshot[]): {
  views: VisualCohort[];
  byUnitId: Map<number, number>;
} {
  const views: VisualCohort[] = [];
  const byUnitId = new Map<number, number>();
  for (const side of ['left', 'right']) {
    const groups = new Map<string, BattleUnitSnapshot[]>();
    let total = 0;
    for (const unit of units) {
      if (unit.side !== side) continue;
      const key = `${unit.type}:${unit.tier}:${unit.slot}`;
      const group = groups.get(key) ?? [];
      group.push(unit);
      groups.set(key, group);
      total++;
    }
    const cap = Math.min(total, VISIBLE_PER_SIDE);
    const allocations = [...groups.values()].map((members) => ({
      members,
      quota: (members.length * cap) / total,
      count: Math.max(1, Math.floor((members.length * cap) / total)),
    }));
    let assigned = allocations.reduce((sum, a) => sum + a.count, 0);
    while (assigned !== cap) {
      const adding = assigned < cap;
      const candidates = allocations.filter((a) =>
        adding ? a.count < a.members.length : a.count > 1,
      );
      candidates.sort((a, b) =>
        adding
          ? b.quota - b.count - (a.quota - a.count)
          : b.count - b.quota - (a.count - a.quota),
      );
      candidates[0].count += adding ? 1 : -1;
      assigned += adding ? 1 : -1;
    }
    for (const { members, count } of allocations) {
      for (let index = 0; index < count; index++) {
        const start = Math.floor((index * members.length) / count);
        const end = Math.floor(((index + 1) * members.length) / count);
        const unitIds = members.slice(start, end).map((u) => u.id);
        const id = views.length;
        views.push({
          id,
          unit: members[start],
          unitIds,
          aliveCount: unitIds.length,
        });
        unitIds.forEach((unitId) => byUnitId.set(unitId, id));
      }
    }
  }
  return { views, byUnitId };
}

export function densityLabel(count: number, visible: number): string {
  return `${count.toLocaleString('en-US')} troops${count > visible ? ` · ${visible} shown` : ''}`;
}
const lanes: Record<FormationSlot, number> = {
  front: 0,
  middle: 8,
  rear: 16,
  'left-flank': -13,
  'right-flank': 23,
};
export function battlefieldPoint(
  position: number,
  slot: FormationSlot,
  index: number,
): { x: number; y: number } {
  const p = Math.max(-1, Math.min(1, position));
  return {
    x: Math.round(240 + p * 205),
    y: Math.round(148 + 66 * (1 - Math.abs(p)) + lanes[slot] + (index % 5) * 3),
  };
}

/** Gate aperture first, then progressively unfold the lane and rank offsets.
 * The same path folds survivors back into their gate on the return leg. */
export function displayedUnitPoint(view: VisualCohort & { position: number }): {
  x: number;
  y: number;
} {
  const side = view.unit.side === 'left' ? 1 : -1;
  const emergence = Math.max(0, Math.min(1, (view.position * side + 1) / 0.25));
  const point = battlefieldPoint(view.position, view.unit.slot, view.id);
  const spread = (Math.floor(view.id / 5) % 7) * 4;
  return {
    x: Math.round(point.x - 1 - spread * side * emergence),
    y: Math.round(147 + (point.y - 147) * emergence),
  };
}
export function unitFrame(milliseconds: number, index: number): number {
  return Math.floor(milliseconds / 160 + index) % 2;
}
export class EventCursor {
  private source: BattleEventLog | null = null;
  constructor(private readonly budget = 4096) {
    if (!Number.isSafeInteger(budget) || budget < 1)
      throw new RangeError('Invalid event budget');
  }
  index = 0;
  pending = false;
  get length(): number {
    return this.source?.length ?? 0;
  }
  attach(source: BattleEventLog): void {
    this.clear();
    this.source = source;
  }
  drain(tick: number, consume: (event: BattleEvent) => void): number {
    if (!this.source) return 0;
    const due = this.source.findTick(Math.floor(tick) + 1);
    const end = Math.min(due, this.index + this.budget);
    const start = this.index;
    while (this.index < end) consume(this.source.at(this.index++)!);
    this.pending = this.index < due;
    return this.index - start;
  }
  clear(): void {
    this.source = null;
    this.index = 0;
    this.pending = false;
  }
}
