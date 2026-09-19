# Medieval Idle Web Prototype

A browser-first Phaser prototype for a medieval idle combat game.

## Development

```bash
npm ci
npm run dev
```

The game renders at a logical resolution of 480 × 270 with nearest-neighbor pixel rendering.

Requires Node 22+ (CI uses Node 22). You command blue Alderwatch on the left;
the red Emberfall opponent is fixed and listed in the deployment panel. Choose
formations, counts and tier percentages, then click **To Battle**. During
combat only Pause / 1× / 2× / 4× are available. Every new battle starts at 4×;
the symmetric infantry scenario takes 82.75 seconds of combat playback
(about 84 seconds including the gate introduction). The renderer owns playback time;
speed does not change the deterministic result.

The default roster has 120 troops. Deployments are capped at 240 before any
UI-thread simulation; 2,000-v-2,000 mobile readiness is explicitly out of scope.
At the terminal result, surviving player troops gain victory progression and
return to the campaign inventory alongside undeployed reserves. Reload restores
the roster and last result from validated, versioned localStorage with a valid
previous-save backup. Storage failures are shown; progress then lasts only in
the current tab. Reload during an unfinished battle restores the prior completed
campaign, not an in-progress replay. Defeated troops are not replenished.
Only when the entire saved roster is depleted, **Start new campaign** becomes
available. It asks for explicit confirmation before replacing the campaign and
last result with the initial 120-troop prototype roster. Cancel changes nothing;
confirmation saves the new campaign and rotates the depleted save to backup.
This is a new campaign, not revival or an implemented recruitment economy.

Playback controls occupy their own layout row below the fitted 16:9 canvas,
not an overlay on the battlefield. Preparation remains independently scrollable.

Open `/?dev=1` for a collapsed, labeled developer preset selector. Choosing a
preset **replaces the current campaign roster**, making acceptance runs/reset
explicit. Three specified army matchups and a positive-survivor formation
comparison are available. The normal route has no preset controls. See
[PrototypePlaytest](docs/PrototypePlaytest.md) for exact seeds, expected
survivors, browser instructions and the unverified manual checklist.

Audio is synthesized locally: seven shared voices, no assets to download. It
starts only on To Battle, suspends when paused, and stops/disconnects after
return or shutdown. Missing Web Audio is silent. See
[audio notes](public/audio/README.md). Actual sound quality and mobile autoplay
remain unverified.

## Quality gates

```bash
npm run lint
npm run format:check
npm test
npm run build
npx playwright install --with-deps chromium
npm run test:e2e
```

Node tests are not proof of browser/GPU/audio quality. The current environment
has no Chromium executable; the eight Playwright tests have been attempted but
are blocked before their bodies execute. Do not call this browser-accepted.

## Build and deployment

`npm run build` emits `dist/`; preview with
`npx vite preview --host 127.0.0.1 --port 4173`. `vite.config.ts` derives the
project Pages base path from `GITHUB_REPOSITORY` (and uses `/` locally).
GitHub Actions runs checks and deploys
`dist/` to GitHub Pages only from `main`, after its build job passes.

No repository was pushed, merged, or published as part of this release candidate.
Before deploying, choose/authorize the remote repository and audience, pass the
browser/manual gates, enable GitHub Pages with GitHub Actions as the source,
then use the reviewed integration flow. Verify the public URL and exact tested
commit afterward. See the playtest document for unresolved release gates.
