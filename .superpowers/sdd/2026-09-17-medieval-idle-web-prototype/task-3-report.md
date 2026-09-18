# Task 3 Report — Combat Stats, Experience, and Soft Counters

## Status

Implemented the combat-rule domain with unit statistics, experience scaling,
soft counters, formation positioning, and deterministic bounded damage.

## RED evidence

Added `tests/unit/combatRules.test.ts` before the production module. The
required failing run was:

```text
npm test -- tests/unit/combatRules.test.ts
FAIL tests/unit/combatRules.test.ts
Error: Cannot find module '../../src/domain/combatRules'
```

The failure was caused by the missing production module, which confirmed the
tests exercised the new API rather than existing behavior.

## GREEN evidence

Added `src/domain/combatRules.ts` and re-ran the targeted suite:

```text
npm test -- tests/unit/combatRules.test.ts
Test Files  1 passed (1)
Tests       17 passed (17)
```

The initial GREEN run revealed normal IEEE-754 representation for the `1.12`
experience multiplier (`112.00000000000001` instead of `112`). The multiplier
assertions were changed to precision-aware numeric assertions; no combat
arithmetic was changed to conceal the behavior.

## API decisions

- `UnitStats` contains `health`, `attack`, `range`, `moveSpeed`, and
  `attackInterval`.
- `getStats(type, tier)` applies the specified experience multiplier to health
  and attack while retaining the unit type's intrinsic range, movement speed,
  and attack interval.
- `DamageModifiers` explicitly supplies attack and defense multipliers,
  matchup and formation multipliers, the plains terrain, and the deterministic
  random factor. Defender health provides the defense baseline.
- `resolveDamage` multiplies the attack-side, matchup, formation, terrain, and
  clamped random factors; divides by health-derived defense; scales and rounds
  the result; and enforces a minimum of one damage.
- All combat values are held in the exported, deeply frozen readonly
  `COMBAT_TUNING` table. The random factor is clamped to `0.90` through `1.10`.

## Files

- `src/domain/combatRules.ts`
- `tests/unit/combatRules.test.ts`
- `.superpowers/sdd/2026-09-17-medieval-idle-web-prototype/task-3-report.md`

## Final verification

```text
npm test -- tests/unit/combatRules.test.ts  # 1 file, 17/17 tests passed
npm test                                    # 2 files, 25/25 tests passed
npm run lint                                # exit 0
npm run format:check                        # all files formatted
npm run build                               # TypeScript and Vite build passed
git diff --check                            # no whitespace errors
```

## Commit

`feat: add experience stats and soft counters`

## Concerns

The prototype currently has only `plains` terrain, so its terrain multiplier
is neutral by design. Additional terrain types can be added to
`COMBAT_TUNING.terrainMultiplier` without changing the damage API.
