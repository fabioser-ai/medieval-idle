import type { ExperienceTier, FormationSlot, UnitType } from './army';

export interface UnitStats {
  readonly health: number;
  readonly attack: number;
  readonly range: number;
  readonly moveSpeed: number;
  readonly attackInterval: number;
}

export interface DamageModifiers {
  /** Multiplies the attacker's attack stat before other combat modifiers. */
  readonly attackMultiplier: number;
  /** Multiplies the defender's health-derived defense. */
  readonly defenseMultiplier: number;
  readonly matchupMultiplier: number;
  readonly formationMultiplier: number;
  readonly terrain: 'plains';
  /** Multiplies the selected terrain's baseline effect. */
  readonly terrainMultiplier: number;
  /** Deterministic random value supplied by the battle simulation. */
  readonly randomFactor: number;
}

function freezeDeep<T>(value: T): T {
  if (typeof value !== 'object' || value === null || Object.isFrozen(value)) {
    return value;
  }

  Object.freeze(value);
  for (const nested of Object.values(value)) {
    freezeDeep(nested);
  }
  return value;
}

export const COMBAT_TUNING = freezeDeep({
  unitStats: {
    infantry: {
      health: 100,
      attack: 20,
      range: 1,
      moveSpeed: 1,
      attackInterval: 1,
    },
    archer: {
      health: 70,
      attack: 16,
      range: 5,
      moveSpeed: 1.1,
      attackInterval: 1.2,
    },
    spearman: {
      health: 90,
      attack: 18,
      range: 1.5,
      moveSpeed: 0.9,
      attackInterval: 1.1,
    },
    cavalry: {
      health: 85,
      attack: 24,
      range: 1,
      moveSpeed: 1.5,
      attackInterval: 0.9,
    },
  },
  experienceMultiplier: {
    recruit: 1,
    trained: 1.12,
    veteran: 1.28,
    elite: 1.48,
  },
  matchupMultiplier: {
    spearman: { cavalry: 1.5 },
    cavalry: { archer: 1.4 },
    archer: { infantry: 1.25 },
    infantry: { spearman: 1.15 },
    neutral: 1,
  },
  formationMultiplier: {
    archer: {
      front: 0.8,
      rear: 1.1,
    },
    cavalry: {
      'left-flank': 1.1,
      'right-flank': 1.1,
    },
    neutral: 1,
  },
  terrainMultiplier: {
    plains: 1,
  },
  randomFactor: {
    minimum: 0.9,
    maximum: 1.1,
  },
  modifiers: {
    neutral: 1,
  },
  damage: {
    scale: 10,
    minimum: 1,
    minimumDefense: 1,
    maximum: Number.MAX_SAFE_INTEGER,
  },
} as const);

export function getStats(type: UnitType, tier: ExperienceTier): UnitStats {
  const baseStats = COMBAT_TUNING.unitStats[type];
  const experienceMultiplier = COMBAT_TUNING.experienceMultiplier[tier];

  return Object.freeze({
    ...baseStats,
    health: baseStats.health * experienceMultiplier,
    attack: baseStats.attack * experienceMultiplier,
  });
}

export function matchupMultiplier(
  attacker: UnitType,
  defender: UnitType,
): number {
  const matchup = COMBAT_TUNING.matchupMultiplier[attacker];

  return (
    matchup?.[defender as keyof typeof matchup] ??
    COMBAT_TUNING.matchupMultiplier.neutral
  );
}

export function formationMultiplier(
  slot: FormationSlot,
  type: UnitType,
): number {
  const formation =
    COMBAT_TUNING.formationMultiplier[
      type as keyof Pick<
        typeof COMBAT_TUNING.formationMultiplier,
        'archer' | 'cavalry'
      >
    ];

  return (
    formation?.[slot as keyof typeof formation] ??
    COMBAT_TUNING.formationMultiplier.neutral
  );
}

function finiteOrNeutral(value: number): number {
  return Number.isFinite(value) ? value : COMBAT_TUNING.modifiers.neutral;
}

function clampRandomFactor(value: number): number {
  if (Number.isNaN(value)) {
    return COMBAT_TUNING.randomFactor.minimum;
  }

  return Math.min(
    COMBAT_TUNING.randomFactor.maximum,
    Math.max(COMBAT_TUNING.randomFactor.minimum, value),
  );
}

function roundBoundedDamage(value: number): number {
  if (!Number.isFinite(value)) {
    return value > COMBAT_TUNING.damage.minimum
      ? COMBAT_TUNING.damage.maximum
      : COMBAT_TUNING.damage.minimum;
  }

  return Math.min(
    COMBAT_TUNING.damage.maximum,
    Math.max(COMBAT_TUNING.damage.minimum, Math.round(value)),
  );
}

export function resolveDamage(
  attacker: UnitStats,
  defender: UnitStats,
  modifiers: DamageModifiers,
): number {
  const randomFactor = clampRandomFactor(modifiers.randomFactor);
  const attack =
    finiteOrNeutral(attacker.attack) *
    finiteOrNeutral(modifiers.attackMultiplier);
  const defense = Math.max(
    COMBAT_TUNING.damage.minimumDefense,
    finiteOrNeutral(defender.health) *
      finiteOrNeutral(modifiers.defenseMultiplier),
  );
  const modifiersProduct =
    finiteOrNeutral(modifiers.matchupMultiplier) *
    finiteOrNeutral(modifiers.formationMultiplier) *
    COMBAT_TUNING.terrainMultiplier[modifiers.terrain] *
    finiteOrNeutral(modifiers.terrainMultiplier) *
    randomFactor;
  const damage =
    (attack * modifiersProduct * COMBAT_TUNING.damage.scale) / defense;

  return roundBoundedDamage(damage);
}
