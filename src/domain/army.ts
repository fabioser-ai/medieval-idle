export type UnitType = 'infantry' | 'archer' | 'spearman' | 'cavalry';
export type ExperienceTier = 'recruit' | 'trained' | 'veteran' | 'elite';
export type FormationSlot =
  'front' | 'middle' | 'rear' | 'left-flank' | 'right-flank';
export type ArmySide = 'left' | 'right';

export interface UnitCohort {
  readonly type: UnitType;
  readonly tier: ExperienceTier;
  readonly count: number;
  /** Lifetime victories survived; omitted legacy/trained cohorts start at zero. */
  readonly survivedVictories?: number;
}

export interface FormationGroup {
  readonly slot: FormationSlot;
  readonly cohorts: readonly UnitCohort[];
}

export interface ArmyDeployment {
  readonly kingdom: string;
  readonly side: ArmySide;
  readonly groups: readonly FormationGroup[];
}

export const UNIT_TYPES: readonly UnitType[] = Object.freeze([
  'infantry',
  'archer',
  'spearman',
  'cavalry',
]);

export const EXPERIENCE_TIERS: readonly ExperienceTier[] = Object.freeze([
  'recruit',
  'trained',
  'veteran',
  'elite',
]);

export const FORMATION_SLOTS: readonly FormationSlot[] = Object.freeze([
  'front',
  'middle',
  'rear',
  'left-flank',
  'right-flank',
]);

export const ARMY_SIDES: readonly ArmySide[] = Object.freeze(['left', 'right']);

const isUnitType = (value: unknown): value is UnitType =>
  typeof value === 'string' &&
  (UNIT_TYPES as readonly string[]).includes(value);

const isExperienceTier = (value: unknown): value is ExperienceTier =>
  typeof value === 'string' &&
  (EXPERIENCE_TIERS as readonly string[]).includes(value);

const isFormationSlot = (value: unknown): value is FormationSlot =>
  typeof value === 'string' &&
  (FORMATION_SLOTS as readonly string[]).includes(value);

const isArmySide = (value: unknown): value is ArmySide =>
  typeof value === 'string' &&
  (ARMY_SIDES as readonly string[]).includes(value);

export function validateDeployment(deployment: ArmyDeployment): string[] {
  const value = deployment as unknown as {
    kingdom?: unknown;
    side?: unknown;
    groups?: unknown;
  };
  const errors: string[] = [];

  if (typeof value.kingdom !== 'string' || value.kingdom.trim() === '') {
    errors.push('Kingdom name cannot be blank.');
  }

  if (!isArmySide(value.side)) {
    errors.push('Army side is invalid.');
  }

  const groups = Array.isArray(value.groups) ? value.groups : [];
  if (!Array.isArray(value.groups)) {
    errors.push('Formation groups must be an array.');
  }
  const slots = groups.map((group) =>
    typeof group === 'object' && group !== null
      ? (group as { slot?: unknown }).slot
      : undefined,
  );
  const validSlots = slots.filter((slot): slot is FormationSlot =>
    isFormationSlot(slot),
  );

  if (new Set(validSlots).size !== validSlots.length) {
    errors.push('Formation slots must be unique.');
  }

  let livingUnits = 0;
  for (const group of groups) {
    if (typeof group !== 'object' || group === null) {
      errors.push('Formation group is invalid.');
      continue;
    }

    const groupValue = group as { slot?: unknown; cohorts?: unknown };
    if (!isFormationSlot(groupValue.slot)) {
      errors.push('Formation slot is invalid.');
    }

    const cohorts = Array.isArray(groupValue.cohorts) ? groupValue.cohorts : [];
    if (!Array.isArray(groupValue.cohorts)) {
      errors.push('Cohorts must be an array.');
    }
    for (const cohort of cohorts) {
      if (typeof cohort !== 'object' || cohort === null) {
        errors.push('Unit cohort is invalid.');
        continue;
      }

      const cohortValue = cohort as {
        type?: unknown;
        tier?: unknown;
        count?: unknown;
        survivedVictories?: unknown;
      };
      if (
        cohortValue.survivedVictories !== undefined &&
        (typeof cohortValue.survivedVictories !== 'number' ||
          !Number.isSafeInteger(cohortValue.survivedVictories) ||
          cohortValue.survivedVictories < 0)
      ) {
        errors.push('Survived victories must be a nonnegative safe integer.');
      }
      if (!isUnitType(cohortValue.type)) {
        errors.push('Unit type is invalid.');
      }
      if (!isExperienceTier(cohortValue.tier)) {
        errors.push('Experience tier is invalid.');
      }
      if (
        typeof cohortValue.count !== 'number' ||
        !Number.isInteger(cohortValue.count)
      ) {
        errors.push('Cohort count must be an integer.');
      } else if (cohortValue.count < 0) {
        errors.push('Cohort count cannot be negative.');
      } else {
        livingUnits += cohortValue.count;
      }
    }
  }

  if (livingUnits === 0) {
    errors.push('Deployment must contain at least one unit.');
  }

  return errors;
}

export function totalLivingUnits(deployment: ArmyDeployment): number {
  return deployment.groups.reduce(
    (total, group) =>
      total +
      group.cohorts.reduce(
        (groupTotal, cohort) =>
          groupTotal + (Number.isFinite(cohort.count) ? cohort.count : 0),
        0,
      ),
    0,
  );
}

export function getCount(
  deployment: ArmyDeployment,
  type: UnitType,
  tier: ExperienceTier,
): number {
  return deployment.groups.reduce(
    (total, group) =>
      total +
      group.cohorts.reduce(
        (groupTotal, cohort) =>
          groupTotal +
          (cohort.type === type && cohort.tier === tier ? cohort.count : 0),
        0,
      ),
    0,
  );
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

export function cloneDeployment(deployment: ArmyDeployment): ArmyDeployment {
  const clone: ArmyDeployment = {
    kingdom: deployment.kingdom,
    side: deployment.side,
    groups: deployment.groups.map((group) => ({
      slot: group.slot,
      cohorts: group.cohorts.map((cohort) => ({
        type: cohort.type,
        tier: cohort.tier,
        count: cohort.count,
        ...(cohort.survivedVictories === undefined
          ? {}
          : { survivedVictories: cohort.survivedVictories }),
      })),
    })),
  };

  return import.meta.env?.DEV ? freezeDeep(clone) : clone;
}
