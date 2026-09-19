# Task 4 — deterministic battle simulation

Status: performance fix implemented and verified; awaiting parent review.

## Final API and behavior

- `simulateBattle(left, right, seed, options?)` retains the required three-argument API. The optional `{ maxTicks }` diagnostic ceiling remains an integer in 1–100,000.
- `BattleResult` still contains the outcome, winner, survivor deployments, duration, original seed, and immutable initial-unit snapshots. `events` is now an explicit immutable `BattleEventLog`, not an `Array` and not a `Proxy` pretending to be one.
- `BattleEventLog` exposes `length`, allocated `byteLength`, `at(index)`, `findTick(tick)`, and iteration. Consumers can seek or stream without materializing millions of event objects. `at` supports negative indices.
- The log stores event kinds in `Uint8`, IDs in `Uint16`, exact numeric dictionary references in `Uint32`, selected per-event numbers in `Float64`, and tick runs in paired `Uint32` arrays. Float64 values, including signed zero, round-trip exactly. Decoded event objects and the log surface are frozen.
- Targeting builds immutable position snapshots in O(n log n) and performs exact nearest-target queries in O(log n). Equal-distance ties, including floating-point distance plateaus across multiple positions, select the lowest stable unit ID exactly as the former brute-force scan did.
- Inert cooldown ticks are skipped only when no unit moved, no unit died, and every living unit is cooling down. The loop advances to the next logical attack tick without renumbering events, altering the tick ceiling, or consuming PRNG draws.
- The validated resource envelope is **4,000 combined units**, measured with 2,000 units on each side. A 4,001-unit battle is rejected before expansion. This replaces the former unmeasured 10,000-unit guard.
- Seed normalization remains intentional Mulberry32 low-32-bit behavior while `BattleResult.seed` records the caller's original safe integer. Tests now pin `0`, `2^32 - 1`, `2^32`, `2^32 + 1`, the corresponding negative boundaries, and both safe-integer endpoints.

## Performance fix round 1/5 — RED / GREEN

### RED

- Baseline commit `c6b94f0` selected a target by scanning every opposing unit for every living unit before movement and again before attacks. That is O(ticks × units²), and it retained every event as an eager JavaScript object.
- The added regression suite defines the failure boundary directly: the 4,000-target/query operation-count test rejects quadratic lookup growth; the 2,000-vs-2,000 approach test requires a bounded runtime; and the full battle requires a terminal result plus compact-storage and process-growth budgets.
- Exactness is guarded independently of speed: a brute-force target oracle compares every result field and every event for 30 deterministic randomized battles, while the pre-optimization fixture is pinned by SHA-256 hash `a32a5b4c9dbc9dbf6e3bc789ccaf677a3ceb03656784f4a4976edf7ce5f03e3a`.

### GREEN

- Indexed targeting, packed lazy event decoding, and inert-tick skipping satisfy the scaling tests while retaining the golden fixture hash and all 30 complete brute-force oracle comparisons.
- Targeted Task 4 verification: 5 files, 56 tests passed. The full 2,000-vs-2,000 battle emitted exactly 4,013,979 events over 44,620 logical ticks.
- Isolated benchmark on this runner: 6,465.33 ms, 95.72 MiB allocated event storage, and 95.36 MiB measured heap-plus-array-buffer growth. The enforced gates are under 15,000 ms, under 110 MiB event storage, and under 256 MiB measured process growth.
- The interrupted note's earlier 3.21 s timing was not reproduced in this final audit. Fresh runs on the current runner measured 6.02–6.47 s; both remain inside the enforced 15 s ceiling.
- The interrupted implementation required no production-code correction during the final audit. The only completion gap found was explicit low-32-bit boundary coverage; the expanded boundary table passed without a behavior change.

## Verification gates

- Targeted Task 4: `npm test -- tests/unit/battleSimulation.test.ts tests/unit/battleEventLog.test.ts tests/unit/targetIndex.test.ts tests/unit/battleOracle.test.ts tests/unit/battleScaling.test.ts --reporter=verbose` — 5 files, 56 tests passed.
- Full run 1: `npm test -- --reporter=verbose` — 7 files, 89 tests passed; 7.63 s. Its 2,000-vs-2,000 sample completed in 6,024.93 ms with 156.19 MiB measured process growth.
- Full run 2: `npm test` — 7 files, 89 tests passed; 8.22 s.
- `npm run lint` — exit 0.
- `npm run format:check` — all matched files use Prettier style.
- `npm run build` — TypeScript and Vite passed; 7 modules transformed, exit 0.
- `git diff --check` — exit 0.
- No browser/E2E run is claimed; this change is pure domain code.

## Remaining risk

The measured packed event log is about 95.72 MiB for the maximum supported battle, and observed process growth was 95–156 MiB depending on test-runner state. That is substantially smaller than four million eager event objects but still a real mobile memory risk, especially alongside Phaser textures, audio, and browser overhead. The 4,000-unit limit is therefore a measured prototype ceiling, not a mobile-safety guarantee. Downstream playback must iterate or seek the log and must not spread it into an array. A future mobile-hardening round should profile representative low-memory devices and consider bounded replay windows or persistence/streaming before increasing the cap.

The only recurring environment warning is npm's pre-existing unknown `http-proxy` configuration warning; no project test, lint, formatter, TypeScript, or Vite warning/error is accepted as passing.
