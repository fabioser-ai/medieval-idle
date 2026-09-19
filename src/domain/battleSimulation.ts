import { totalLivingUnits, validateDeployment } from './army';
import type { ArmyDeployment, ArmySide } from './army';
import type { BattleResult, BattleUnitSnapshot } from './battleEvents';
import {
  COMBAT_TUNING,
  formationMultiplier,
  getStats,
  matchupMultiplier,
  resolveDamage,
} from './combatRules';
import type { UnitStats } from './combatRules';
import { createTargetIndex } from './targetIndex';
import { BattleEventLogBuilder } from './battleEventLog';

export type { BattleResult } from './battleEvents';

export const CHARGE_DISTANCE = 0.28;
export const SIMULATION_TUNING = Object.freeze({
  ticksPerSecond: 20,
  distanceScale: 0.05,
  marchSpeedMultiplier: 0.6,
  maxTicks: 100_000,
  maxUnits: 4_000,
});

export interface BattleSimulationOptions {
  readonly maxTicks?: number;
}
export type BattleSimulationErrorCode =
  'invalid-deployment' | 'invalid-seed' | 'invalid-options' | 'stalemate';

export class BattleSimulationError extends Error {
  readonly code: BattleSimulationErrorCode;
  readonly tick: number;

  constructor(code: BattleSimulationErrorCode, message: string, tick = 0) {
    super(message);
    this.name = 'BattleSimulationError';
    this.code = code;
    this.tick = tick;
  }
}

type MutableSnapshot = {
  -readonly [Key in keyof BattleUnitSnapshot]: BattleUnitSnapshot[Key];
};
interface SimUnit extends MutableSnapshot {
  readonly stats: UnitStats;
  readonly groupIndex: number;
  readonly cohortIndex: number;
  charged: boolean;
}

function freezeDeep<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freezeDeep(child);
    Object.freeze(value);
  }
  return value;
}

/** Mulberry32; safe-integer seeds deliberately map to their low 32 bits. */
function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = Math.imul(state ^ (state >>> 15), state | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function validateArmy(army: ArmyDeployment, side: ArmySide): void {
  if (army === null || typeof army !== 'object') {
    throw new BattleSimulationError(
      'invalid-deployment',
      `${side} deployment must be an object.`,
    );
  }
  const errors = validateDeployment(army);
  if (army.side !== side) errors.push(`Expected the ${side} deployment.`);
  if (errors.length > 0)
    throw new BattleSimulationError('invalid-deployment', errors.join(' '));
}

function expandArmy(army: ArmyDeployment, units: SimUnit[]): void {
  army.groups.forEach((group, groupIndex) => {
    group.cohorts.forEach((cohort, cohortIndex) => {
      const stats = getStats(cohort.type, cohort.tier);
      for (let index = 0; index < cohort.count; index += 1) {
        units.push({
          id: units.length + 1,
          type: cohort.type,
          tier: cohort.tier,
          slot: group.slot,
          side: army.side,
          hitPoints: stats.health,
          position: army.side === 'left' ? -1 : 1,
          targetId: null,
          nextAttackTick: 0,
          survivedVictories: cohort.survivedVictories ?? 0,
          stats,
          groupIndex,
          cohortIndex,
          charged: false,
        });
      }
    });
  });
}

function snapshot(unit: SimUnit): BattleUnitSnapshot {
  return {
    id: unit.id,
    type: unit.type,
    tier: unit.tier,
    slot: unit.slot,
    side: unit.side,
    hitPoints: unit.hitPoints,
    position: unit.position,
    targetId: unit.targetId,
    nextAttackTick: unit.nextAttackTick,
    survivedVictories: unit.survivedVictories,
  };
}

function survivors(
  army: ArmyDeployment,
  alive: readonly SimUnit[],
): ArmyDeployment {
  const counts = army.groups.map((group) => group.cohorts.map(() => 0));
  for (const unit of alive) {
    if (unit.side === army.side) counts[unit.groupIndex][unit.cohortIndex] += 1;
  }
  return {
    kingdom: army.kingdom,
    side: army.side,
    groups: army.groups.map((group, groupIndex) => ({
      slot: group.slot,
      cohorts: group.cohorts.map((cohort, cohortIndex) => ({
        type: cohort.type,
        tier: cohort.tier,
        count: counts[groupIndex][cohortIndex],
        ...(cohort.survivedVictories === undefined
          ? {}
          : { survivedVictories: cohort.survivedVictories }),
      })),
    })),
  };
}

/**
 * Pure fixed-step simulation. Every tick: choose targets / charge, move simultaneously,
 * retarget, schedule attacks in ID order, apply aggregate damage, remove deaths, finish.
 * Contact uses each unit's stat range * .05 (including melee reach); movement uses
 * that same distance scale per second and never retreats from an in-range enemy.
 */
export function simulateBattle(
  left: ArmyDeployment,
  right: ArmyDeployment,
  seed: number,
  options: BattleSimulationOptions = {},
): BattleResult {
  validateArmy(left, 'left');
  validateArmy(right, 'right');
  if (
    totalLivingUnits(left) + totalLivingUnits(right) >
    SIMULATION_TUNING.maxUnits
  ) {
    throw new BattleSimulationError(
      'invalid-deployment',
      `Battle cannot exceed ${SIMULATION_TUNING.maxUnits} units.`,
    );
  }
  if (!Number.isSafeInteger(seed))
    throw new BattleSimulationError(
      'invalid-seed',
      'Seed must be a safe integer.',
    );
  if (options === null || typeof options !== 'object' || Array.isArray(options))
    throw new BattleSimulationError(
      'invalid-options',
      'Options must be an object.',
    );
  const maxTicks =
    options.maxTicks === undefined
      ? SIMULATION_TUNING.maxTicks
      : options.maxTicks;
  if (
    !Number.isInteger(maxTicks) ||
    maxTicks < 1 ||
    maxTicks > SIMULATION_TUNING.maxTicks
  ) {
    throw new BattleSimulationError(
      'invalid-options',
      `maxTicks must be an integer from 1 to ${SIMULATION_TUNING.maxTicks}.`,
    );
  }

  const units: SimUnit[] = [];
  expandArmy(left, units);
  expandArmy(right, units);
  const initialUnits = units.map(snapshot);
  let alive = units;
  const events = new BattleEventLogBuilder();
  events.push({ type: 'gate-opened', side: 'left', tick: 0 });
  events.push({ type: 'gate-opened', side: 'right', tick: 0 });
  events.push({ type: 'march-started', side: 'left', tick: 0 });
  events.push({ type: 'march-started', side: 'right', tick: 0 });
  const random = seededRandom(seed);
  const { distanceScale, ticksPerSecond, marchSpeedMultiplier } =
    SIMULATION_TUNING;

  for (let tick = 1; tick <= maxTicks; tick += 1) {
    const leftAlive = alive.filter((unit) => unit.side === 'left');
    const rightAlive = alive.filter((unit) => unit.side === 'right');
    let leftIndex = createTargetIndex(leftAlive);
    let rightIndex = createTargetIndex(rightAlive);
    const nearestTarget = (unit: SimUnit) =>
      (unit.side === 'left' ? rightIndex : leftIndex).nearest(unit.position);
    const positions = alive.map((unit) => {
      const target = nearestTarget(unit);
      unit.targetId = target.id;
      const distance = Math.abs(target.position - unit.position);
      if (!unit.charged && distance <= CHARGE_DISTANCE) {
        unit.charged = true;
        events.push({
          type: 'charge-started',
          tick,
          unitId: unit.id,
          targetId: target.id,
          side: unit.side,
          position: unit.position,
          distance,
        });
      }
      const speed =
        ((unit.stats.moveSpeed * distanceScale) / ticksPerSecond) *
        (unit.charged ? 1 : marchSpeedMultiplier);
      const step = Math.min(
        speed,
        Math.max(0, distance - unit.stats.range * distanceScale),
      );
      return Math.max(
        -1,
        Math.min(
          1,
          unit.position + Math.sign(target.position - unit.position) * step,
        ),
      );
    });
    const moved = alive.some(
      (unit, index) => unit.position !== positions[index],
    );
    alive.forEach((unit, index) => {
      unit.position = positions[index];
    });
    leftIndex = createTargetIndex(leftAlive);
    rightIndex = createTargetIndex(rightAlive);

    const damageByTarget = new Map<number, number>();
    for (const unit of alive) {
      const target = nearestTarget(unit);
      unit.targetId = target.id;
      if (
        unit.nextAttackTick > tick ||
        Math.abs(target.position - unit.position) >
          unit.stats.range * distanceScale + 1e-12
      )
        continue;
      // Consume exactly one random draw for each scheduled attack, never for movement.
      const randomFactor =
        COMBAT_TUNING.randomFactor.minimum +
        random() *
          (COMBAT_TUNING.randomFactor.maximum -
            COMBAT_TUNING.randomFactor.minimum);
      const damage = resolveDamage(unit.stats, target.stats, {
        attackMultiplier: 1,
        defenseMultiplier: 1,
        matchupMultiplier: matchupMultiplier(unit.type, target.type),
        formationMultiplier: formationMultiplier(unit.slot, unit.type),
        terrain: 'plains',
        terrainMultiplier: 1,
        randomFactor,
      });
      damageByTarget.set(
        target.id,
        (damageByTarget.get(target.id) ?? 0) + damage,
      );
      unit.nextAttackTick =
        tick + Math.ceil(unit.stats.attackInterval * ticksPerSecond);
      events.push({
        type: 'attack',
        tick,
        attackerId: unit.id,
        targetId: target.id,
        damage,
        randomFactor,
        attackerPosition: unit.position,
        targetPosition: target.position,
      });
    }
    for (const unit of alive) {
      unit.hitPoints -= damageByTarget.get(unit.id) ?? 0;
      if (unit.hitPoints <= 0)
        events.push({
          type: 'death',
          tick,
          unitId: unit.id,
          side: unit.side,
          position: unit.position,
        });
    }
    const beforeDeaths = alive.length;
    alive = alive.filter((unit) => unit.hitPoints > 0);
    const hasLeft = alive.some((unit) => unit.side === 'left');
    const hasRight = alive.some((unit) => unit.side === 'right');
    if (!hasLeft || !hasRight) {
      const winner = hasLeft ? 'left' : hasRight ? 'right' : null;
      const outcome = winner === null ? 'draw' : 'victory';
      events.push({ type: 'battle-ended', tick, outcome, winner });
      return freezeDeep({
        outcome,
        winner,
        leftSurvivors: survivors(left, alive),
        rightSurvivors: survivors(right, alive),
        durationTicks: tick,
        seed,
        initialUnits,
        events: events.finish(),
      });
    }
    // With no movement/deaths and all attackers cooling down, skipped ticks have
    // no state changes or events. Preserve the logical attack ticks and ceiling.
    if (
      !moved &&
      alive.length === beforeDeaths &&
      alive.every((unit) => unit.nextAttackTick > tick)
    ) {
      let nextAttackTick = maxTicks + 1;
      for (const unit of alive)
        nextAttackTick = Math.min(nextAttackTick, unit.nextAttackTick);
      tick = nextAttackTick - 1;
    }
  }
  throw new BattleSimulationError(
    'stalemate',
    `Battle did not resolve within ${maxTicks} ticks.`,
    maxTicks,
  );
}
