# Prototype playtest and acceptance record

## Status and evidence boundary

Release candidate, **not browser/device accepted and not published**.
This record distinguishes deterministic Node tests from browser/manual evidence.
No screenshots, GPU observations, audio listening results, physical-device
performance measurements, or public URL verification have been collected.

Automated Node evidence covers real simulation, playback, UI handlers, scene
adapter behavior against a lightweight DOM/GPU boundary, bounded audio against
an injected engine, campaign/save validation, backup recovery and progression.
The real scene integration confirms a positive surviving archer is committed
at terminal result, not before, and survives SaveStore reload.

Current final-fix verification: `npm test` passed **219 tests in 24 files on two
consecutive full runs**. `npm run lint`, `npm run format:check`, `npm run build`
and `git diff --check` exited 0. The native Web Audio adapter was also exercised
against a fake native context: seven oscillators/seven gains, bounded scheduled
automation, handled resume rejection, and every node disconnected over three
battles. This proves adapter calls, not audible output or browser behavior.

`npm run test:e2e` was attempted for eight tests. All eight stopped before
test-body execution: Playwright could not find
`chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell`.
This is an environment blocker, **not a browser pass**. Browser console-error,
layout, gesture/autoplay and persistence assertions are written but UNVERIFIED.
The current Node evidence includes explicit depleted-campaign confirmation,
cancel/reload preservation, backup rotation, fresh playable editor/controller,
and 4× initial UI/scene playback. A CSS/DOM source contract protects separate
grid rows; it is not a browser layout-engine or actual geometry measurement.

## Fixed scenarios

Use `/?dev=1`, expand **Developer acceptance presets**, then choose a scenario.
Selecting explicitly replaces the campaign roster and saves that starting roster.
The selector is absent from the normal route. Blue Alderwatch on the left is
always the player; red Emberfall on the right is a fixed opponent. Enemy units
are listed with their slots in the deployment panel, not editable strategy.

All seeds are integer **626**. Ticks are 50 ms. Outcomes below are automated
simulation expectations, not observed browser/device outcomes.

| Preset         | Player (left)                                        | Fixed enemy (right)                                  | Expected result | Raw survivors L / R     | Ticks | Browser actual |
| -------------- | ---------------------------------------------------- | ---------------------------------------------------- | --------------- | ----------------------- | ----- | -------------- |
| equal-infantry | 100 recruit infantry, front                          | 100 recruit infantry, front                          | Draw            | 0 / 0                   | 6620  | UNVERIFIED     |
| veteran-line   | 60 veteran infantry, front; 30 trained archers, rear | 150 recruit infantry, front                          | Right victory   | 0 / 90 recruit infantry | 2393  | UNVERIFIED     |
| spear-and-bow  | 40 recruit spearmen, front; 20 veteran archers, rear | 35 trained cavalry, front; 40 recruit infantry, rear | Right victory   | 0 / 40 recruit infantry | 1646  | UNVERIFIED     |
| archer-rear    | 5 trained archers, rear                              | 4 recruit infantry, front                            | Left victory    | 1 trained archer / 0    | 1897  | UNVERIFIED     |
| archer-front   | Same 5 trained archers, front                        | Same 4 recruit infantry, front                       | Right victory   | 0 / 1 recruit infantry  | 2132  | UNVERIFIED     |

The first three armies match the required compositions exactly. In limited
slot exploration at seed 626 (not an exhaustive balance search), they produced
no living player survivors. The additional two scenarios therefore do real
work: rear vs front changes the winner without changing seed, type, tier or
quantity, and the rear scenario proves **nonzero** survivor persistence.
The winning archer remains trained with `survivedVictories: 1`.
No combat balance values were changed to force these expectations.

## Fabio's browser run

On a machine with browser installation available:

```bash
npm ci
npx playwright install --with-deps chromium
npm run lint
npm run format:check
npm test
npm test
npm run build
npm run test:e2e
```

For manual testing, run `npm run dev -- --host 0.0.0.0` on a trusted local
network and open the displayed URL with `/?dev=1`. Start quietly with speakers
or headphones at low volume. Every new battle defaults to 4×. The symmetric
infantry case takes 82.75 seconds of combat playback (331 seconds at 1×),
approximately 84 seconds with the gate introduction; the others are shorter.
No deterministic combat ticks or balance changed. Each browser acceptance test allows
150 seconds and waits for the persisted terminal summary, not a guessed delay.

For **each** preset, record browser/version, OS/device, viewport/orientation,
commit, seed, expected result, observed result, survivor roster after reload,
console errors and defects. Do not replace UNVERIFIED with PASS until observed.

- [ ] No audio before To Battle, including initial load and preset selection.
- [ ] Every visible soldier originates inside its own gate; no edge leakage.
- [ ] March, charge, melee and return are visually distinct; formations readable.
- [ ] Bow trajectories originate at displayed bows and terminate near targets.
- [ ] Gate, steps, hooves, arrows, melee and result sounds are distinguishable.
- [ ] Pause freezes presentation and suspends sound; 1×/2×/4× resume cleanly.
- [ ] Speeds affect viewing only: repeat the same preset at 1× and 4× and
      compare recorded outcome and survivor roster.
- [ ] Terminal result matches the table; survivor summary remains accessible.
- [ ] Reload restores exact inventory and last result, especially archer-rear.
- [ ] Rear-to-front archer change produces the winner reversal shown above.
- [ ] An undeployed reserve stays available and keeps its own victory history.
- [ ] Repeat at least five battles using explicit preset reselection; no stacked
      audio, lingering contexts after return, or growing active node count.
- [ ] After return, fields and keyboard focus recover, with surviving inventory
      instead of the old full roster. Depleted troops do not respawn on reload.
- [ ] Normal route, genuinely depleted roster: Start new campaign opens an
      explicit replacement confirmation. Cancel and reload preserve the empty
      roster and result. Confirm restores 120 initial troops, clears the last
      result, rotates the depleted backup, and allows another battle after reload.
- [ ] With Web Audio unavailable/blocked, silent gameplay still works.
- [ ] With storage blocked, visible save failure notice appears; gameplay works
      in memory but does not claim durable persistence.
- [ ] After two saves, corrupt only the primary `medieval-idle.save` in DevTools;
      reload reports recovery from `medieval-idle.save.backup`. Restore test
      data or choose a fresh preset afterward.
- [ ] At desktop 1440×900 and landscape 844×390: canvas wholly in viewport,
      fitted 16:9 aspect, no overlap between canvas and viewing card, no horizontal
      overflow, controls at least 44×44, text legible, preparation scrollable.
- [ ] Check real Safari/iOS and Chrome/Android: autoplay, background/resume,
      audio interruptions, touch behavior and comfortable frame rate.

| Browser/device/version | Viewport   | Preset / seed | Expected    | Actual     | Reload roster | Defects                              |
| ---------------------- | ---------- | ------------- | ----------- | ---------- | ------------- | ------------------------------------ |
| UNVERIFIED             | UNVERIFIED | All / 626     | Table above | UNVERIFIED | UNVERIFIED    | Not run: no browser/device available |

## Remaining release gates

- Browser suite must pass; manual visual/listening/device checklist must be run.
- Rendering at 2,000 vs 2,000 is **not** a mobile-readiness claim. The UI rejects
  deployments over 240 before synchronous simulation; fixed scenarios are modest.
  Maximum-size simulation still requires a worker/incremental integration and
  real-device memory/frame measurements before being exposed interactively.
- Publishing requires Fabio's repository/audience decision and an explicit
  push/merge/publish authorization. Then verify the public URL serves the exact
  tested commit and complete a public-origin smoke test. None performed here.
