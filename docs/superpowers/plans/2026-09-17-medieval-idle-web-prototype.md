# Medieval Idle Web Combat Prototype Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and publish a playable browser prototype in which two configured pixel-art medieval armies leave opposing castles, descend hills, accelerate near contact, and fight automatically until one army has no survivors.

**Architecture:** A pure TypeScript domain layer resolves deterministic battles without browser or Phaser dependencies. Phaser consumes the immutable event log to animate pooled sprites and play layered audio, while a DOM overlay handles deployment and playback controls. Vite builds a static site suitable for GitHub Pages; Vitest validates the domain and Playwright validates the browser flow.

**Tech Stack:** TypeScript 5, Phaser 3, Vite, Vitest, Playwright, ESLint, Prettier, GitHub Actions, GitHub Pages, localStorage.

**Spec:** `Medieval_Idle_Game_Design_v1.md`, especially sections 3–7, 10–12, 16, and 21–23. This web plan supersedes the Unity-specific implementation plan but not the game design.

## Global Constraints

- Browser-first static application; no Python or Streamlit dependency in the game runtime.
- Landscape playfield with a 480 × 270 logical resolution scaled using nearest-neighbor rendering.
- Chunky retro pixel art, hard edges, limited palette, and no antialiasing.
- Player castle on the left hill; enemy fortification on the right hill; valley in the center.
- Every visible deployed unit begins inside a gate, exits physically, marches downhill, and accelerates near contact.
- Units: infantry, archers, spearmen, cavalry.
- Formation slots: front, middle, rear, left flank, right flank.
- Experience tiers: recruit, trained, veteran, elite.
- Strategy ends when battle begins; pause and speed controls alter presentation only.
- Victory is last-army-standing; deterministic simultaneous annihilation is a draw.
- No heroes, magic, monsters, special weapons, retreat, surrender, revival, prisoners, purchases, ads, accounts, server, map, scouts, or online ranking in this prototype.
- Simulation outcome must be identical for identical deployments and integer seed.
- Domain files may not import Phaser, DOM APIs, browser storage, or rendering code.
- Deployed casualties remain dead; survivors retain and may advance experience.
- The prototype must run from a static GitHub Pages URL and remain playable on desktop Safari/Chrome and mobile Safari in landscape.

---

## File Map

```text
medieval-idle/
├── .github/workflows/ci-pages.yml
├── public/
│   ├── audio/
│   └── sprites/
├── src/
│   ├── domain/
│   │   ├── army.ts
│   │   ├── combatRules.ts
│   │   ├── battleEvents.ts
│   │   ├── battleSimulation.ts
│   │   └── survivorProgression.ts
│   ├── application/
│   │   ├── battleSession.ts
│   │   └── saveStore.ts
│   ├── game/
│   │   ├── config.ts
│   │   ├── BattleScene.ts
│   │   ├── UnitViewPool.ts
│   │   ├── PixelUnitFactory.ts
│   │   └── BattleAudio.ts
│   ├── ui/
│   │   ├── deployment.ts
│   │   └── controls.ts
│   ├── styles.css
│   └── main.ts
├── tests/
│   ├── fixtures.ts
│   ├── unit/
│   └── e2e/combat.spec.ts
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```

---

### Task 1: Static Phaser Project, Quality Gates, and Pages Pipeline

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vite.config.ts`
- Create: `eslint.config.js`
- Create: `.prettierrc.json`
- Create: `index.html`
- Create: `src/main.ts`
- Create: `src/styles.css`
- Create: `src/game/config.ts`
- Create: `tests/e2e/combat.spec.ts`
- Create: `.github/workflows/ci-pages.yml`
- Create: `README.md`

**Interfaces:**
- Produces: `createGame(parent: HTMLElement): Phaser.Game`.
- Produces: scripts `dev`, `build`, `test`, `test:e2e`, `lint`, `format:check`.
- Produces: Pages artifact from `dist/` on pushes to `main`.

- [ ] **Step 1: Scaffold package metadata with exact commands**

Use package scripts:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "test": "vitest run",
    "test:e2e": "playwright test",
    "lint": "eslint .",
    "format:check": "prettier --check ."
  }
}
```

Install runtime dependency `phaser`; install TypeScript, Vite, Vitest, Playwright, ESLint, TypeScript ESLint, and Prettier as development dependencies. Commit the generated lockfile.

- [ ] **Step 2: Write the failing browser smoke test**

```ts
import { expect, test } from '@playwright/test';

test('opens the combat prototype shell', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Medieval Idle' })).toBeVisible();
  await expect(page.locator('canvas')).toHaveCount(1);
});
```

- [ ] **Step 3: Verify the smoke test fails**

Run `npm run test:e2e`.

Expected: failure because the application shell and canvas do not exist.

- [ ] **Step 4: Implement the minimal Phaser shell**

Create a responsive full-screen page with an accessible `h1`, a `#game` host, and `createGame`. Configure Phaser for `Phaser.AUTO`, logical size 480 × 270, `pixelArt: true`, `antialias: false`, transparent false, scale mode `FIT`, and auto-center `CENTER_BOTH`.

- [ ] **Step 5: Add CI and Pages deployment**

The workflow uses Node 22, `npm ci`, Playwright Chromium installation, lint, format check, unit tests, production build, E2E tests against `vite preview`, Pages artifact upload, and deployment only from `main`. Set Vite `base` from `GITHUB_REPOSITORY` so project Pages paths work.

- [ ] **Step 6: Verify all gates**

Run:

```bash
npm run lint
npm run format:check
npm test
npm run build
npm run test:e2e
```

Expected: all commands exit 0 and `dist/index.html` exists.

- [ ] **Step 7: Commit**

```bash
git add .
git commit -m "chore: initialize Phaser web prototype"
```

---

### Task 2: Immutable Army and Deployment Domain

**Files:**
- Create: `src/domain/army.ts`
- Create: `tests/fixtures.ts`
- Create: `tests/unit/army.test.ts`

**Interfaces:**
- Produces: string unions `UnitType`, `ExperienceTier`, `FormationSlot`, `ArmySide`.
- Produces: readonly interfaces `UnitCohort`, `FormationGroup`, `ArmyDeployment`.
- Produces: `validateDeployment(deployment): string[]`.
- Produces: `totalLivingUnits(deployment): number`.
- Produces: `getCount(deployment, type, tier): number`.
- Produces: deterministic fixtures `blueArmy()`, `redArmy()`, and `singleCohortArmy(...)`.

- [ ] **Step 1: Write failing domain tests**

```ts
it('rejects a negative cohort count', () => {
  const army = singleCohortArmy('left', 'infantry', 'recruit', -1);
  expect(validateDeployment(army)).toContain('Cohort count cannot be negative.');
});

it('counts units across tiers and slots', () => {
  const army = blueArmy();
  expect(totalLivingUnits(army)).toBe(130);
  expect(getCount(army, 'infantry', 'veteran')).toBe(20);
});
```

- [ ] **Step 2: Run and verify failure**

Run `npm test -- tests/unit/army.test.ts`.

Expected: failure because `src/domain/army.ts` does not exist.

- [ ] **Step 3: Implement readonly domain values**

Use readonly arrays and objects. Valid values are exactly four unit types, four experience tiers, five formation slots, and two sides. Validation rejects blank kingdom name, invalid strings, negative/noninteger counts, duplicate slots, and zero deployed units.

- [ ] **Step 4: Protect battle input from UI mutation**

Implement `cloneDeployment` using explicit structural copying of groups and cohorts. Freeze the returned object in development mode. Tests must mutate the original builder after cloning and confirm the clone remains unchanged.

- [ ] **Step 5: Run tests and commit**

```bash
npm test -- tests/unit/army.test.ts
git add src/domain/army.ts tests
git commit -m "feat: model immutable army deployments"
```

---

### Task 3: Combat Stats, Experience, and Soft Counters

**Files:**
- Create: `src/domain/combatRules.ts`
- Create: `tests/unit/combatRules.test.ts`

**Interfaces:**
- Produces: `UnitStats` with `health`, `attack`, `range`, `moveSpeed`, `attackInterval`.
- Produces: `getStats(type, tier): UnitStats`.
- Produces: `matchupMultiplier(attacker, defender): number`.
- Produces: `formationMultiplier(slot, type): number`.
- Produces: `resolveDamage(attacker, defender, modifiers): number`.

- [ ] **Step 1: Write failing counter and experience tests**

```ts
it.each([
  ['spearman', 'cavalry', 1.5],
  ['cavalry', 'archer', 1.4],
  ['archer', 'infantry', 1.25],
  ['infantry', 'spearman', 1.15],
] as const)('%s has a soft advantage over %s', (attacker, defender, expected) => {
  expect(matchupMultiplier(attacker, defender)).toBe(expected);
});

it('elite infantry is stronger but not invulnerable', () => {
  const recruit = getStats('infantry', 'recruit');
  const elite = getStats('infantry', 'elite');
  expect(elite.attack).toBeGreaterThan(recruit.attack);
  expect(elite.health).toBeGreaterThan(recruit.health);
  expect(elite.health).toBeLessThan(recruit.health * 3);
});
```

- [ ] **Step 2: Verify failure**

Run `npm test -- tests/unit/combatRules.test.ts`.

- [ ] **Step 3: Implement centralized rule tables**

Use experience multipliers 1.00, 1.12, 1.28, and 1.48. Use the exact tested counter values; unspecified matchups return 1.00. Rear archers receive 1.10, frontline archers 0.80, and flank cavalry 1.10. Keep every tuning value exported from one readonly `COMBAT_TUNING` object.

- [ ] **Step 4: Implement bounded damage**

Clamp seeded random factor to 0.90–1.10. Apply attack, defense, matchup, formation, and plains terrain modifiers. Return an integer of at least 1.

- [ ] **Step 5: Run tests and commit**

```bash
npm test -- tests/unit/combatRules.test.ts
git add src/domain/combatRules.ts tests/unit/combatRules.test.ts
git commit -m "feat: add experience stats and soft counters"
```

---

### Task 4: Deterministic Battle Simulation and Event Log

**Files:**
- Create: `src/domain/battleEvents.ts`
- Create: `src/domain/battleSimulation.ts`
- Create: `tests/unit/battleSimulation.test.ts`

**Interfaces:**
- Produces: event types `gate-opened`, `march-started`, `charge-started`, `attack`, `death`, `battle-ended`.
- Produces: `simulateBattle(left, right, seed): BattleResult`.
- Produces: `BattleResult` containing `outcome`, `winner`, survivor deployments, `durationTicks`, `seed`, and readonly ordered events.

- [ ] **Step 1: Write failing determinism tests**

```ts
it('produces identical results for identical input and seed', () => {
  const first = simulateBattle(blueArmy(), redArmy(), 41721);
  const second = simulateBattle(blueArmy(), redArmy(), 41721);
  expect(second).toEqual(first);
});

it('ends with living units on at most one side', () => {
  const result = simulateBattle(blueArmy(), redArmy(), 12);
  const leftAlive = totalLivingUnits(result.leftSurvivors);
  const rightAlive = totalLivingUnits(result.rightSurvivors);
  expect(leftAlive === 0 || rightAlive === 0).toBe(true);
});
```

- [ ] **Step 2: Verify failure**

Run `npm test -- tests/unit/battleSimulation.test.ts`.

- [ ] **Step 3: Implement stable seeded simulation state**

Expand cohorts into plain `SimUnit` records with stable integer ID, type, tier, slot, side, hit points, normalized position, target ID, next attack tick, and survived-victory count. Use a small local PRNG implementation whose state depends only on the integer seed.

- [ ] **Step 4: Implement movement and contact**

Use normalized positions -1 to +1. Left begins at -1, right at +1. Units march at 60% speed until an enemy is within `CHARGE_DISTANCE = 0.28`, then emit `charge-started` and use full speed. Ranged units stop at range; melee continues to contact.

- [ ] **Step 5: Implement deterministic target selection and attacks**

Select nearest valid target, breaking equal distances by stable ID. Process random factors in stable attacker-ID order. Apply all scheduled attacks before removing dead units so simultaneous deaths are possible.

- [ ] **Step 6: Implement terminal outcomes**

One surviving side wins. If both sides reach zero during the same tick, outcome is `draw` and winner is `null`. Enforce a high deterministic tick ceiling and return an explicit `stalemate` error if invalid tuning prevents contact; never silently invent a winner.

- [ ] **Step 7: Run the suite twice and commit**

```bash
npm test
npm test
git add src/domain/battleEvents.ts src/domain/battleSimulation.ts tests/unit/battleSimulation.test.ts
git commit -m "feat: simulate deterministic last-man-standing battles"
```

---

### Task 5: Survivor Progression, Battle Session, and Browser Save

**Files:**
- Create: `src/domain/survivorProgression.ts`
- Create: `src/application/battleSession.ts`
- Create: `src/application/saveStore.ts`
- Create: `tests/unit/survivorProgression.test.ts`
- Create: `tests/unit/battleSession.test.ts`
- Create: `tests/unit/saveStore.test.ts`

**Interfaces:**
- Produces: `applySurvivorProgression(result, side): ArmyDeployment`.
- Produces: phases `preparing`, `gates`, `marching`, `charging`, `fighting`, `result`, `returning`.
- Produces: `BattleSession.start(left, right, seed)` and `setPlaybackSpeed(0 | 1 | 2 | 4)`.
- Produces: `SaveStore.save(data)` and `SaveStore.load(): LoadResult` using localStorage.

- [ ] **Step 1: Write failing survivor and storage tests**

```ts
it('removes dead units and promotes a recruit after one survived victory', () => {
  const progressed = applySurvivorProgression(resultWithSingleRecruitSurvivor(), 'left');
  expect(totalLivingUnits(progressed)).toBe(1);
  expect(getCount(progressed, 'infantry', 'trained')).toBe(1);
});

it('recovers the last valid backup after corrupt primary JSON', () => {
  const storage = new MemoryStorage();
  const store = new SaveStore(storage);
  store.save(firstSave());
  store.save(secondSave());
  storage.setItem('medieval-idle.save', '{broken');
  expect(store.load()).toEqual({ status: 'corrupt-recovered', data: firstSave() });
});
```

- [ ] **Step 2: Verify failure**

Run the three new test files and confirm missing-module failures.

- [ ] **Step 3: Implement progression**

Preserve survived-victory metadata per cohort. Winning survivors promote at 1 victory to trained, 3 to veteran, and 7 to elite. Draw survivors retain their tier and receive no victory.

- [ ] **Step 4: Implement immutable playback session**

Compute the full result exactly once when starting. Session phase follows event timestamps. Playback speed controls wall-clock consumption only; changing speed must never change events, survivors, or outcome.

- [ ] **Step 5: Implement versioned localStorage with backup**

Use keys `medieval-idle.save` and `medieval-idle.save.backup`, schema version 1, explicit validation, and defensive parsing. Save kingdom identity, available cohorts, `reservedTrainerCohorts` as an explicitly empty version-1 array, last seed, and last result summary. Rotate a valid primary to backup before replacing it.

- [ ] **Step 6: Run tests and commit**

```bash
npm test
git add src/domain/survivorProgression.ts src/application tests/unit
git commit -m "feat: persist and progress battle survivors"
```

---

### Task 6: Pixel Battlefield, Gates, Pooled Units, and Playback

**Files:**
- Create: `src/game/PixelUnitFactory.ts`
- Create: `src/game/UnitViewPool.ts`
- Create: `src/game/BattleScene.ts`
- Create: `tests/unit/unitViewPool.test.ts`
- Modify: `src/game/config.ts`
- Modify: `src/main.ts`

**Interfaces:**
- Consumes: immutable `BattleSession` events.
- Produces: procedural prototype sprites for all four unit classes and both army colors.
- Produces: `UnitViewPool.acquire(id)` and `releaseAll()` with `totalCreated`.
- Produces: one visible sprite per simulation unit up to 400 per side, with visual aggregation beyond that cap.

- [ ] **Step 1: Write the failing pool test**

```ts
it('reuses released unit views', () => {
  const pool = createTestPool(20);
  const first = Array.from({ length: 20 }, (_, id) => pool.acquire(id));
  pool.releaseAll();
  const second = Array.from({ length: 20 }, (_, id) => pool.acquire(id));
  expect(pool.totalCreated).toBe(20);
  expect(new Set(second)).toEqual(new Set(first));
});
```

- [ ] **Step 2: Verify failure**

Run `npm test -- tests/unit/unitViewPool.test.ts`.

- [ ] **Step 3: Generate prototype pixel textures in Phaser**

Use `Phaser.GameObjects.Graphics` to draw small hard-edged sprites at runtime: shield infantry, bow archer, long-spear unit, and horse/rider silhouette. Use blue/silver for left and red/black for right. Generate simple two-frame march and attack texture variants without image smoothing.

- [ ] **Step 4: Draw the approved battlefield**

Create a left stone castle and gate on a green hill, a right wooden fort and gate, distant mountains, and a broad valley. Keep all gameplay coordinates mapped to the 480 × 270 logical resolution.

- [ ] **Step 5: Present the event log**

Spawn visible units behind their gate. Open gates, animate march paths downhill by formation lane, switch to faster movement on `charge-started`, show arrow arcs for ranged attacks, play melee frames on attack, and play one short death animation before pooling the view. Survivors return uphill after result.

- [ ] **Step 6: Implement aggregation and verify performance**

Beyond 400 simulation units per side, map cohorts proportionally to visible sprites and display a compact density badge. Rendering count never changes simulation count. Confirm no new sprite creation after pool warm-up during a repeated 2,000-versus-2,000 playback.

- [ ] **Step 7: Run tests, build, and commit**

```bash
npm test
npm run build
git add src/game src/main.ts tests/unit/unitViewPool.test.ts
git commit -m "feat: render pooled pixel armies on two hills"
```

---

### Task 7: Deployment UI and Viewing-Only Battle Controls

**Files:**
- Create: `src/ui/deployment.ts`
- Create: `src/ui/controls.ts`
- Create: `tests/unit/deployment.test.ts`
- Modify: `index.html`
- Modify: `src/styles.css`
- Modify: `src/main.ts`
- Modify: `tests/e2e/combat.spec.ts`

**Interfaces:**
- Produces: `DeploymentEditor` managing inventory-safe assignments for five positions and four experience tiers.
- Produces: `buildDeployment(): ArmyDeployment` only when valid.
- Produces: pause, 1×, 2×, and 4× playback controls.

- [ ] **Step 1: Write failing inventory and E2E tests**

```ts
it('cannot assign more veterans than available', () => {
  const editor = editorWithInventory({ infantry: { veteran: 10 } });
  editor.assign('front', 'infantry', 'veteran', 11);
  expect(editor.canStartBattle).toBe(false);
  expect(editor.validationMessage).toContain('10 veteran infantry available');
});
```

Extend Playwright to assign two groups, press `To Battle`, verify deployment controls hide, and verify only pause/1×/2×/4× remain.

- [ ] **Step 2: Verify test failures**

Run unit and E2E test files.

- [ ] **Step 3: Implement the landscape deployment overlay**

Provide five large touch zones with unit type, quantity, and recruit/trained/veteran/elite ratios. Recompute remaining inventory after every edit. Disable `To Battle` with one precise visible validation message for negative, noninteger, excessive, or empty deployment.

- [ ] **Step 4: Implement battle controls without mutation hooks**

When battle begins, create an immutable deployment clone and hide all strategy inputs. Controls may only call `BattleSession.setPlaybackSpeed` or camera pan/zoom; no combat-domain mutation method is exposed.

- [ ] **Step 5: Verify responsive touch behavior**

Run Playwright at desktop 1440 × 900 and mobile landscape 844 × 390. Confirm no horizontal page scroll, canvas fit, 44 CSS-pixel minimum control targets, and readable validation text.

- [ ] **Step 6: Run gates and commit**

```bash
npm run lint
npm test
npm run build
npm run test:e2e
git add index.html src tests
git commit -m "feat: configure formations and experience ratios"
```

---

### Task 8: Hybrid Audio, Acceptance Scenarios, and Release

**Files:**
- Create: `src/game/BattleAudio.ts`
- Create: `public/audio/README.md`
- Create: `tests/unit/battleAudio.test.ts`
- Create: `docs/PrototypePlaytest.md`
- Modify: `src/game/BattleScene.ts`
- Modify: `tests/e2e/combat.spec.ts`
- Modify: `README.md`

**Interfaces:**
- Consumes: session phase, active counts, attack density, and result.
- Produces: at most eight persistent Web Audio/Phaser sound layers.
- Produces: fixed acceptance scenarios with seeds and expected outcomes.

- [ ] **Step 1: Write failing bounded-audio test**

```ts
it('uses bounded audio layers for large armies', () => {
  const audio = createAudioHarness();
  audio.setArmyCounts(400, 400);
  audio.onPhase('charging');
  expect(audio.activeLoopCount).toBeLessThanOrEqual(8);
  expect(audio.chargeIntensity).toBeGreaterThan(audio.marchIntensity);
});
```

- [ ] **Step 2: Verify failure**

Run `npm test -- tests/unit/battleAudio.test.ts`.

- [ ] **Step 3: Implement synthesized prototype audio**

Use Web Audio oscillators/noise and short envelopes for gate creak, layered footsteps, hoofbeats, arrow release/impact, melee density, and result sting. Start audio only after the player's `To Battle` gesture to satisfy mobile autoplay rules. Use shared layers rather than per-unit sounds.

- [ ] **Step 4: Add fixed acceptance scenarios**

Expose developer presets:

1. 100 recruit infantry versus 100 recruit infantry.
2. 60 veteran infantry plus 30 trained archers versus 150 recruit infantry.
3. 40 recruit spearmen plus 20 veteran archers versus 35 trained cavalry plus 40 recruit infantry.

Store a fixed integer seed and asserted outcome for each. Playwright runs every preset, verifies terminal result, reloads, and confirms survivor persistence.

- [ ] **Step 5: Run full verification**

```bash
npm run lint
npm run format:check
npm test
npm run build
npm run test:e2e
```

Expected: all commands exit 0, no browser console errors, and all acceptance outcomes match recorded expectations.

- [ ] **Step 6: Complete manual acceptance**

Record browser/device, seed, expected outcome, actual outcome, and defects in `docs/PrototypePlaytest.md`. Confirm every soldier originates at a gate, armies march then charge, formation remains readable, speed changes do not alter outcome, survivors persist, and at least one changed formation changes an outcome.

- [ ] **Step 7: Commit release candidate**

```bash
git add .
git commit -m "test: verify playable web combat prototype"
```

- [ ] **Step 8: Publish GitHub Pages**

Push the reviewed branch, merge through the selected integration flow, enable GitHub Pages with GitHub Actions as source, and verify the public URL loads the exact tested commit. Publishing is an external side effect and requires the user's final repository/audience choice if it has not already been supplied.

---

## Completion Boundary

This plan ends with a static, playable, tested combat prototype. Separate later plans cover time-based recruitment and veteran instructors; scouts; territory campaigns and enemy recovery; AI kings; final commissioned pixel assets; production balancing; analytics; advertisements; Remove Ads purchase; account services; and native mobile packaging or Unity migration.
