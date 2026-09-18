import { describe, expect, it } from 'vitest';

import {
  COMBAT_TUNING,
  formationMultiplier,
  getStats,
  matchupMultiplier,
  resolveDamage,
  type DamageModifiers,
  type UnitStats,
} from '../../src/domain/combatRules';

const baselineModifiers: DamageModifiers = {
  attackMultiplier: 1,
  defenseMultiplier: 1,
  matchupMultiplier: 1,
  formationMultiplier: 1,
  terrain: 'plains',
  randomFactor: 1,
};

const attacker: UnitStats = {
  health: 100,
  attack: 100,
  range: 1,
  moveSpeed: 1,
  attackInterval: 1,
};

const defender: UnitStats = {
  health: 100,
  attack: 10,
  range: 1,
  moveSpeed: 1,
  attackInterval: 1,
};

describe('combat rules', () => {
  it.each([
    ['spearman', 'cavalry', 1.5],
    ['cavalry', 'archer', 1.4],
    ['archer', 'infantry', 1.25],
    ['infantry', 'spearman', 1.15],
  ] as const)(
    '%s has a soft advantage over %s',
    (attackerType, defenderType, expected) => {
      expect(matchupMultiplier(attackerType, defenderType)).toBe(expected);
    },
  );

  it('leaves unspecified matchups neutral', () => {
    expect(matchupMultiplier('infantry', 'archer')).toBe(1);
  });

  it.each([
    ['recruit', 100, 20],
    ['trained', 112, 22.4],
    ['veteran', 128, 25.6],
    ['elite', 148, 29.6],
  ] as const)(
    'scales infantry health and attack for %s experience',
    (tier, expectedHealth, expectedAttack) => {
      const stats = getStats('infantry', tier);

      expect(stats.health).toBeCloseTo(expectedHealth);
      expect(stats.attack).toBeCloseTo(expectedAttack);
    },
  );

  it('elite infantry is stronger but not invulnerable', () => {
    const recruit = getStats('infantry', 'recruit');
    const elite = getStats('infantry', 'elite');

    expect(elite.attack).toBeGreaterThan(recruit.attack);
    expect(elite.health).toBeGreaterThan(recruit.health);
    expect(elite.health).toBeLessThan(recruit.health * 3);
  });

  it('gives archers positioning modifiers in the frontline and rear', () => {
    expect(formationMultiplier('front', 'archer')).toBe(0.8);
    expect(formationMultiplier('rear', 'archer')).toBe(1.1);
  });

  it('gives cavalry a flank positioning modifier', () => {
    expect(formationMultiplier('left-flank', 'cavalry')).toBe(1.1);
    expect(formationMultiplier('right-flank', 'cavalry')).toBe(1.1);
  });

  it('leaves other formation and unit combinations neutral', () => {
    expect(formationMultiplier('middle', 'infantry')).toBe(1);
  });

  it('combines attack, defense, matchup, formation, and plains modifiers', () => {
    const damage = resolveDamage(attacker, defender, {
      attackMultiplier: 2,
      defenseMultiplier: 0.5,
      matchupMultiplier: 1.5,
      formationMultiplier: 1.1,
      terrain: 'plains',
      randomFactor: 1,
    });

    expect(damage).toBe(66);
  });

  it('clamps the supplied seeded random factor to the configured range', () => {
    const lowDamage = resolveDamage(attacker, defender, {
      ...baselineModifiers,
      randomFactor: 0,
    });
    const highDamage = resolveDamage(attacker, defender, {
      ...baselineModifiers,
      randomFactor: 100,
    });

    expect(lowDamage).toBe(9);
    expect(highDamage).toBe(11);
  });

  it('never returns less than one damage', () => {
    const noAttack: UnitStats = { ...attacker, attack: 0 };

    expect(resolveDamage(noAttack, defender, baselineModifiers)).toBe(1);
  });

  it('exports immutable combat tuning for rule adjustments', () => {
    expect(Object.isFrozen(COMBAT_TUNING)).toBe(true);
  });
});
