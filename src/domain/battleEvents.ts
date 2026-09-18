import type {
  ArmyDeployment,
  ArmySide,
  ExperienceTier,
  FormationSlot,
  UnitType,
} from './army';

export type BattleOutcome = 'victory' | 'draw';

/** IDs follow deployment order: all left groups/cohorts, then all right. */
export interface BattleUnitSnapshot {
  readonly id: number;
  readonly type: UnitType;
  readonly tier: ExperienceTier;
  readonly slot: FormationSlot;
  readonly side: ArmySide;
  readonly hitPoints: number;
  readonly position: number;
  readonly targetId: number | null;
  readonly nextAttackTick: number;
  readonly survivedVictories: number;
}

interface TimedEvent {
  readonly tick: number;
}

export type BattleEvent =
  | (TimedEvent & { readonly type: 'gate-opened'; readonly side: ArmySide })
  | (TimedEvent & { readonly type: 'march-started'; readonly side: ArmySide })
  | (TimedEvent & {
      readonly type: 'charge-started';
      readonly unitId: number;
      readonly targetId: number;
      readonly side: ArmySide;
      readonly position: number;
      readonly distance: number;
    })
  | (TimedEvent & {
      readonly type: 'attack';
      readonly attackerId: number;
      readonly targetId: number;
      readonly damage: number;
      readonly randomFactor: number;
      readonly attackerPosition: number;
      readonly targetPosition: number;
    })
  | (TimedEvent & {
      readonly type: 'death';
      readonly unitId: number;
      readonly side: ArmySide;
      readonly position: number;
    })
  | (TimedEvent & {
      readonly type: 'battle-ended';
      readonly outcome: BattleOutcome;
      readonly winner: ArmySide | null;
    });

/** Compact immutable replay sequence. Stream or seek; do not materialize large logs. */
export interface BattleEventLog extends Iterable<BattleEvent> {
  readonly length: number;
  /** Allocated compact column storage, excluding small bookkeeping objects. */
  readonly byteLength: number;
  at(index: number): BattleEvent | undefined;
  /** Index of the first event at or after tick (length when past the end). */
  findTick(tick: number): number;
}

export interface BattleResult {
  readonly outcome: BattleOutcome;
  readonly winner: ArmySide | null;
  readonly leftSurvivors: ArmyDeployment;
  readonly rightSurvivors: ArmyDeployment;
  readonly durationTicks: number;
  readonly seed: number;
  readonly initialUnits: readonly BattleUnitSnapshot[];
  readonly events: BattleEventLog;
}
