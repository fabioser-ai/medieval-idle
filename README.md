# Medieval Idle Web Prototype

A browser-first Phaser prototype for a medieval idle combat game.

## Development

```bash
npm install
npm run dev
```

The game renders at a logical resolution of 480 × 270 with nearest-neighbor pixel rendering.

## Quality gates

```bash
npm run lint
npm run format:check
npm test
npm run build
npm run test:e2e
```

GitHub Actions runs these checks and deploys the `dist/` artifact to GitHub Pages only from `main`.
