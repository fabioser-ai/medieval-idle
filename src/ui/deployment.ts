import {
  EXPERIENCE_TIERS,
  FORMATION_SLOTS,
  UNIT_TYPES,
  type ArmyDeployment,
  type ExperienceTier,
  type FormationSlot,
  type UnitType,
  type UnitCohort,
} from '../domain/army';
export type Inventory = Partial<
  Record<UnitType, Partial<Record<ExperienceTier, number>>>
>;
export const slotLabel = (slot: FormationSlot): string =>
  slot.charAt(0).toUpperCase() + slot.slice(1).replace('-', ' ');
interface Assignment {
  type: UnitType;
  quantity: number;
  ratios: readonly number[];
}
export class DeploymentEditor {
  readonly #inventory: Inventory;
  readonly #assignments = new Map<FormationSlot, Assignment>();
  #locked = false;
  constructor(
    inventory: Inventory,
    private readonly maxDeployment = Number.MAX_SAFE_INTEGER,
  ) {
    this.#inventory = {};
    for (const type of UNIT_TYPES) {
      this.#inventory[type] = {};
      for (const tier of EXPERIENCE_TIERS) {
        const count = inventory[type]?.[tier] ?? 0;
        if (!Number.isSafeInteger(count) || count < 0)
          throw new RangeError(
            'Inventory counts must be nonnegative safe integers.',
          );
        this.#inventory[type]![tier] = count;
      }
    }
  }
  assign(
    slot: FormationSlot,
    type: UnitType,
    tier: ExperienceTier,
    count: number,
  ): void {
    if (!EXPERIENCE_TIERS.includes(tier))
      throw new RangeError('Invalid experience tier.');
    this.setRatios(
      slot,
      type,
      count,
      EXPERIENCE_TIERS.map((t) => (t === tier ? 100 : 0)),
    );
  }
  setRatios(
    slot: FormationSlot,
    type: UnitType,
    quantity: number,
    ratios: readonly number[],
  ): void {
    if (this.#locked) throw new Error('Deployment is locked.');
    if (!FORMATION_SLOTS.includes(slot))
      throw new RangeError('Invalid formation slot.');
    if (!UNIT_TYPES.includes(type)) throw new RangeError('Invalid unit type.');
    this.#assignments.set(slot, { type, quantity, ratios: [...ratios] });
  }
  get canStartBattle(): boolean {
    return this.validationMessage === '';
  }
  get validationMessage(): string {
    let total = 0;
    for (const slot of FORMATION_SLOTS) {
      const entry = this.#assignments.get(slot);
      if (!entry) continue;
      if (!Number.isSafeInteger(entry.quantity) || entry.quantity < 0)
        return `${slotLabel(slot)} quantity must be a nonnegative safe integer.`;
      if (
        entry.ratios.length !== 4 ||
        entry.ratios.some((r) => !Number.isInteger(r) || r < 0 || r > 100) ||
        entry.ratios.reduce((a, b) => a + b, 0) !== 100
      )
        return `${slotLabel(slot)} percentages must be whole numbers from 0 to 100 and total 100%.`;
      total += entry.quantity;
    }
    if (total > this.maxDeployment)
      return `Prototype deployment limit is ${this.maxDeployment} soldiers.`;
    for (const type of UNIT_TYPES)
      for (const tier of EXPERIENCE_TIERS) {
        const available = this.#inventory[type]![tier]!;
        const assigned = this.assigned(type, tier);
        if (assigned > available)
          return `Only ${available} ${tier} ${type} available; ${assigned} assigned. Reduce quantity or change percentages.`;
      }
    return total === 0 ? 'Assign at least one unit to a formation.' : '';
  }
  private cohorts(entry: Assignment): UnitCohort[] {
    if (
      !Number.isSafeInteger(entry.quantity) ||
      entry.quantity < 0 ||
      entry.ratios.length !== 4 ||
      entry.ratios.some((r) => !Number.isInteger(r) || r < 0 || r > 100) ||
      entry.ratios.reduce((a, b) => a + b, 0) !== 100
    )
      return [];
    // Largest remainder; ties use the stable recruit/trained/veteran/elite order.
    // Divide before multiplying to avoid precision loss near MAX_SAFE_INTEGER.
    const whole = Math.floor(entry.quantity / 100);
    const tail = entry.quantity % 100;
    const counts = entry.ratios.map(
      (r) => whole * r + Math.floor((tail * r) / 100),
    );
    const order = entry.ratios
      .map((r, i) => ({ i, fraction: (tail * r) % 100 }))
      .sort((a, b) => b.fraction - a.fraction || a.i - b.i);
    const remainder = entry.quantity - counts.reduce((a, b) => a + b, 0);
    for (let i = 0; i < remainder; i++) counts[order[i].i]++;
    return EXPERIENCE_TIERS.flatMap((tier, i) =>
      counts[i] ? [{ type: entry.type, tier, count: counts[i] }] : [],
    );
  }
  private assigned(type: UnitType, tier: ExperienceTier): number {
    let total = 0;
    for (const entry of this.#assignments.values())
      for (const cohort of this.cohorts(entry))
        if (cohort.type === type && cohort.tier === tier) total += cohort.count;
    return total;
  }
  remaining(type: UnitType, tier: ExperienceTier): number {
    return Math.max(
      0,
      (this.#inventory[type]?.[tier] ?? 0) - this.assigned(type, tier),
    );
  }
  buildDeployment(): ArmyDeployment {
    const message = this.validationMessage;
    if (message) throw new Error(message);
    return Object.freeze({
      kingdom: 'Alderwatch',
      side: 'left',
      groups: Object.freeze(
        FORMATION_SLOTS.flatMap((slot) => {
          const entry = this.#assignments.get(slot);
          if (!entry || entry.quantity === 0) return [];
          return [
            Object.freeze({
              slot,
              cohorts: Object.freeze(
                this.cohorts(entry).map((c) => Object.freeze(c)),
              ),
            }),
          ];
        }),
      ),
    });
  }
  lock(): ArmyDeployment {
    const deployment = this.buildDeployment();
    this.#locked = true;
    return deployment;
  }
}
