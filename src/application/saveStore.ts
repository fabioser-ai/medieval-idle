import {
  UNIT_TYPES,
  EXPERIENCE_TIERS,
  type UnitCohort,
  type ArmySide,
} from '../domain/army';
import type { BattleOutcome } from '../domain/battleEvents';

export interface LastResultSummary {
  readonly outcome: BattleOutcome;
  readonly winner: ArmySide | null;
  readonly durationTicks: number;
  readonly leftSurvivors: number;
  readonly rightSurvivors: number;
}
export interface SaveData {
  readonly schemaVersion: 1;
  readonly kingdom: string;
  readonly availableCohorts: readonly (UnitCohort & {
    readonly survivedVictories: number;
  })[];
  readonly reservedTrainerCohorts: readonly [];
  readonly lastSeed: number | null;
  readonly lastResult: LastResultSummary | null;
}
export interface SaveStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}
export type LoadResult =
  | { status: 'empty' | 'corrupt' }
  | { status: 'loaded' | 'corrupt-recovered'; data: SaveData };
export type SaveResult = { status: 'saved' | 'invalid' | 'storage-error' };
const PRIMARY = 'medieval-idle.save';
const BACKUP = 'medieval-idle.save.backup';
const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const nonnegative = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;

function validData(value: unknown): value is SaveData {
  if (
    !record(value) ||
    value.schemaVersion !== 1 ||
    typeof value.kingdom !== 'string' ||
    !value.kingdom.trim() ||
    !Array.isArray(value.availableCohorts) ||
    !Array.isArray(value.reservedTrainerCohorts) ||
    value.reservedTrainerCohorts.length !== 0 ||
    (value.lastSeed !== null && !Number.isSafeInteger(value.lastSeed))
  )
    return false;
  if (
    !value.availableCohorts.every(
      (cohort) =>
        record(cohort) &&
        (UNIT_TYPES as readonly unknown[]).includes(cohort.type) &&
        (EXPERIENCE_TIERS as readonly unknown[]).includes(cohort.tier) &&
        nonnegative(cohort.count) &&
        nonnegative(cohort.survivedVictories),
    )
  )
    return false;
  const summary = value.lastResult;
  if (summary === null) return true;
  if (
    !record(summary) ||
    !nonnegative(summary.durationTicks) ||
    summary.durationTicks < 1 ||
    !nonnegative(summary.leftSurvivors) ||
    !nonnegative(summary.rightSurvivors)
  )
    return false;
  return summary.outcome === 'draw'
    ? summary.winner === null &&
        summary.leftSurvivors === 0 &&
        summary.rightSurvivors === 0
    : summary.outcome === 'victory' &&
        (summary.winner === 'left'
          ? summary.leftSurvivors > 0 && summary.rightSurvivors === 0
          : summary.winner === 'right' &&
            summary.rightSurvivors > 0 &&
            summary.leftSurvivors === 0);
}
function parse(raw: string | null): SaveData | null {
  try {
    const value: unknown = raw === null ? null : JSON.parse(raw);
    return validData(value) ? value : null;
  } catch {
    return null;
  }
}

/** v1 has no implicit migration: unknown versions and missing metadata are corrupt. */
export class SaveStore {
  constructor(private readonly storage?: SaveStorage) {}
  private getStorage(): SaveStorage {
    return this.storage ?? globalThis.localStorage;
  }

  save(data: SaveData): SaveResult {
    try {
      if (!validData(data)) return { status: 'invalid' };
      const serialized = JSON.stringify(data);
      if (!parse(serialized)) return { status: 'invalid' };
      const storage = this.getStorage();
      const primary = storage.getItem(PRIMARY);
      if (parse(primary)) storage.setItem(BACKUP, primary!);
      storage.setItem(PRIMARY, serialized);
      return { status: 'saved' };
    } catch {
      return { status: 'storage-error' };
    }
  }

  load(): LoadResult {
    try {
      const storage = this.getStorage();
      let readFailed = false;
      const read = (key: string): string | null => {
        try {
          return storage.getItem(key);
        } catch {
          readFailed = true;
          return null;
        }
      };
      const primary = read(PRIMARY);
      const data = parse(primary);
      if (data) return { status: 'loaded', data };
      const backup = read(BACKUP);
      const recovered = parse(backup);
      if (recovered) return { status: 'corrupt-recovered', data: recovered };
      return {
        status:
          !readFailed && primary === null && backup === null
            ? 'empty'
            : 'corrupt',
      };
    } catch {
      return { status: 'corrupt' };
    }
  }
}
