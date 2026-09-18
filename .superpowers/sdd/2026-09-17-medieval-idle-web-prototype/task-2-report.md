# Task 2 Report — Immutable Army and Deployment Domain

## Status

Implemented the immutable army/deployment domain and deterministic test fixtures.

## RED evidence

Added `tests/unit/army.test.ts` and `tests/fixtures.ts` before adding the production module. The required failing run was:

```text
npm test -- tests/unit/army.test.ts
FAIL tests/unit/army.test.ts
Error: Cannot find module '../../src/domain/army'
```

The failure was caused by the missing production module, as required by the TDD cycle.

## GREEN evidence

After adding `src/domain/army.ts`, the task test passed:

```text
npm test -- tests/unit/army.test.ts
Test Files  1 passed (1)
Tests       6 passed (6)
```

The implementation provides:

- Four unit types, four experience tiers, five formation slots, and two army sides as string unions.
- Readonly cohort, formation-group, and deployment interfaces.
- Validation for blank names, invalid values, negative/noninteger counts, duplicate slots, invalid groups, and zero-unit deployments.
- Unit totals and type/tier counts across all groups.
- Structural deployment cloning with development-mode deep freezing.
- Deterministic blue, red, and single-cohort fixtures.

## Final verification

```text
npm test
Test Files  1 passed (1)
Tests       6 passed (6)

npm run lint
exit 0

npm run format:check
All matched files use Prettier code style!

npm run build
vite build completed successfully; dist/index.html created.
```

`git diff --check` also completed without whitespace errors.

## Files

- `src/domain/army.ts`
- `tests/fixtures.ts`
- `tests/unit/army.test.ts`
- `.superpowers/sdd/2026-09-17-medieval-idle-web-prototype/task-2-report.md`

## Commit

`feat: model immutable army deployments`

## Concerns

The requested `task-2-brief.md` was not present in the worktree. The checked-in implementation plan’s Task 2 section was used as the requirements fallback; no conflicting task-specific brief was available to compare against.
