import { beforeEach, expect, it, vi } from 'vitest';
import { BattleSession } from '../../src/application/battleSession';
import type { BattlePhase } from '../../src/application/battleSession';
import { demoArmies } from '../../src/game/demoBattle';
import { mountDeployment } from '../../src/ui/deploymentView';
import { ElementBoundary } from '../domBoundary';
import { Campaign } from '../../src/application/campaign';
import { SaveStore } from '../../src/application/saveStore';
import { formationDuel } from '../../src/game/acceptanceScenarios';
import { BattleAudio, type AudioEngine } from '../../src/game/BattleAudio';
import type {
  BattleEvent,
  BattleEventLog,
} from '../../src/domain/battleEvents';

// Replace only the browser/GPU boundary. Real scene create/play/update, texture
// baking, playback, aggregation and pool code all run against this image factory.
const boundary = vi.hoisted(() => {
  class Events {
    private listeners = new Map<string, Set<() => void>>();
    once(event: string, handler: () => void) {
      const handlers = this.listeners.get(event) ?? new Set();
      handlers.add(handler);
      this.listeners.set(event, handlers);
    }
    off(event: string, handler?: () => void) {
      if (handler) this.listeners.get(event)?.delete(handler);
      else this.listeners.delete(event);
    }
    emit(event: string) {
      const handlers = [...(this.listeners.get(event) ?? [])];
      this.listeners.delete(event);
      for (const handler of handlers) handler();
    }
    listenerCount(event: string) {
      return this.listeners.get(event)?.size ?? 0;
    }
  }
  class Display {
    x = 0;
    y = 0;
    depth = 0;
    visible = true;
    active = true;
    flipX = false;
    texture = '';
    alpha = 1;
    angle = 0;
    crop = { x: 0, width: 20 };
    lines: number[][] = [];
    setOrigin() {
      return this;
    }
    setCrop(x: number, _y: number, width: number) {
      this.crop = { x, width };
      return this;
    }
    setResolution() {
      return this;
    }
    setInteractive() {
      return this;
    }
    on() {
      return this;
    }
    setText() {
      return this;
    }
    setScale() {
      return this;
    }
    setVisible(v: boolean) {
      this.visible = v;
      return this;
    }
    setActive(v: boolean) {
      this.active = v;
      return this;
    }
    setAlpha(v: number) {
      this.alpha = v;
      return this;
    }
    setAngle(v: number) {
      this.angle = v;
      return this;
    }
    setDepth(v: number) {
      this.depth = v;
      return this;
    }
    setFlipX(v: boolean) {
      this.flipX = v;
      return this;
    }
    setTexture(v: string) {
      this.texture = v;
      return this;
    }
    setPosition(x: number, y: number) {
      this.x = x;
      this.y = y;
      return this;
    }
    clear() {
      this.lines = [];
      return this;
    }
    lineStyle() {
      return this;
    }
    lineBetween(...line: number[]) {
      this.lines.push(line);
      return this;
    }
    fillStyle() {
      return this;
    }
    fillRect() {
      return this;
    }
    beginPath() {
      return this;
    }
    moveTo() {
      return this;
    }
    lineTo() {
      return this;
    }
    closePath() {
      return this;
    }
    fillPath() {
      return this;
    }
    generateTexture() {
      return this;
    }
    destroy() {}
  }
  const images: Display[] = [];
  const graphics: Display[] = [];
  const image = vi.fn(() => {
    const view = new Display();
    images.push(view);
    return view;
  });
  class Scene {
    cameras = { main: { setRoundPixels() {} } };
    textures = { exists: () => false };
    input = { keyboard: { on() {} } };
    events = new Events();
    game = { canvas: { dataset: {} } };
    add = {
      image,
      graphics: () => {
        const view = new Display();
        graphics.push(view);
        return view;
      },
      rectangle: () => new Display(),
      text: () => new Display(),
    };
  }
  return { images, graphics, image, Scene, Events };
});
vi.mock('phaser', () => ({
  default: {
    Scene: boundary.Scene,
    Scenes: { Events: { SHUTDOWN: 'shutdown', DESTROY: 'destroy' } },
  },
}));
import { BattleScene } from '../../src/game/BattleScene';

beforeEach(() => {
  boundary.images.length = 0;
  boundary.graphics.length = 0;
  boundary.image.mockClear();
});
function boot() {
  const scene = new BattleScene();
  scene.create();
  const [left, right] = demoArmies();
  scene.play(new BattleSession().start(left, right, 626));
  scene.playbackSpeed = 1;
  scene.update(0, 0);
  return scene;
}

it('waits for deployment, announces readiness, and accepts only renderer playback speeds', () => {
  let ready = false;
  const scene = new BattleScene(() => {
    ready = true;
  });
  scene.create();
  expect(scene.playback.phase).toBe('preparing');
  expect(views()).toHaveLength(0);
  expect(ready).toBe(true);
  const [left, right] = demoArmies();
  scene.play(new BattleSession().start(left, right, 626));
  scene.setPlaybackSpeed(0);
  tick(scene, 200);
  expect(scene.playback.time).toBe(0);
  scene.setPlaybackSpeed(4);
  tick(scene, 50);
  expect(scene.playback.time).toBe(200);
  expect(() => scene.setPlaybackSpeed(3 as never)).toThrow(/speed/);
});

it('restores one fresh editor only after return and starts consecutive battles without retaining UI listeners', () => {
  const host = new ElementBoundary('div');
  const scene = new BattleScene((readyScene) =>
    mountDeployment(host as unknown as HTMLElement, readyScene, {
      prefill: false,
    }),
  );
  scene.create();
  const initialNodeCount = host.all().length;
  for (const [battle, quantity] of [4, 7].entries()) {
    const current = host.all();
    expect(current).toHaveLength(initialNodeCount);
    expect(current.filter((node) => node.tag === 'fieldset')).toHaveLength(5);
    expect(
      current.find((node) => node.id === 'inventory-infantry')!.textContent,
    ).toContain(`Recruit ${battle === 0 ? 12 : 8}`);
    const input = current.find(
      (node) => node.attributes['aria-label'] === 'Front quantity',
    )!;
    input.value = String(quantity);
    input.fire('input');
    const start = current.find(
      (node) => node.textContent === 'March to Battle',
    )!;
    expect(start.disabled).toBe(false);
    start.fire('click');
    expect(scene.playback.counts.left).toBe(quantity);
    expect(scene.playbackSpeed).toBe(1);
    tick(scene, 50);
    expect(scene.playback.time).toBe(50);
    const preparation = current.find(
      (node) => node.attributes['aria-label'] === 'Deploy your army',
    )!;
    expect(preparation.hidden).toBe(true);
    scene.setPlaybackSpeed(4);
    tickUntilPhase(scene, 'returning');
    expect(preparation.hidden).toBe(true);
    expect(input.disabled).toBe(true);
    scene.setPlaybackSpeed(0);
    tick(scene, 1000);
    expect(host.all()).toContain(preparation);
    expect(preparation.hidden).toBe(true);
    scene.setPlaybackSpeed(4);
    tickUntilPhase(scene, 'preparing');
    expect(host.all()).not.toContain(preparation);
    expect(
      host
        .all()
        .find((node) => node.attributes['aria-label'] === 'Deploy your army')!
        .hidden,
    ).toBe(false);
    expect(
      host
        .all()
        .find((node) => node.attributes['aria-label'] === 'Front unit type')!
        .focused,
    ).toBe(true);
    expect(
      current.reduce(
        (sum, node) => sum + Object.keys(node.listeners).length,
        0,
      ),
    ).toBe(0);
    const nextNodes = host.all();
    tick(scene, 1000);
    expect(host.all()).toEqual(nextNodes); // No repeated remounts while resting.
    const oldSpeed = scene.playbackSpeed;
    current.find((node) => node.textContent === 'Pause')!.fire('click');
    expect(scene.playbackSpeed).toBe(oldSpeed);
    expect(boundary.image).toHaveBeenCalledTimes(800);
  }
});

it('persists a positive survivor from actual UI and scene terminal phase, then restores it on reload', () => {
  const values = new Map<string, string>();
  const store = new SaveStore({
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
  });
  const campaign = new Campaign(store),
    preset = formationDuel('rear');
  campaign.reset(preset.left);
  const host = new ElementBoundary('div');
  const scene = new BattleScene((ready) =>
    mountDeployment(host as unknown as HTMLElement, ready, {
      campaign,
      preset,
      developer: true,
    }),
  );
  scene.create();
  host
    .all()
    .find((n) => n.textContent === 'March to Battle')!
    .fire('click');
  expect(campaign.data.lastResult).toBeNull();
  scene.setPlaybackSpeed(4);
  tickUntilPhase(scene, 'result');
  expect(campaign.data.lastResult?.winner).toBe('left');
  expect(campaign.data.availableCohorts).toEqual([
    { type: 'archer', tier: 'trained', count: 1, survivedVictories: 1 },
  ]);
  tickUntilPhase(scene, 'preparing');
  const reload = new Campaign(store);
  expect(reload.data).toEqual(campaign.data);
  expect(
    host.all().find((n) => n.id === 'inventory-archer')!.textContent,
  ).toContain('Trained 1');
  expect(host.all().find((n) => n.id === 'last-result')!.textContent).toContain(
    'left 1 · right 0',
  );
});

it('starts audio only through To Battle and follows renderer pause/result/return lifecycle', () => {
  let starts = 0,
    closes = 0,
    state = 'idle';
  const engine: AudioEngine = {
    layer: () => ({ set() {}, stop() {} }),
    resume() {
      state = 'running';
    },
    suspend() {
      state = 'suspended';
    },
    close() {
      closes++;
    },
  };
  const audio = new BattleAudio(() => {
    starts++;
    return engine;
  });
  const host = new ElementBoundary('div');
  const scene = new BattleScene(
    (ready) => mountDeployment(host as unknown as HTMLElement, ready),
    audio,
  );
  scene.create();
  tick(scene, 100);
  expect(starts).toBe(0);
  const qty = host
    .all()
    .find((n) => n.attributes['aria-label'] === 'Front quantity')!;
  qty.value = '4';
  qty.fire('input');
  host
    .all()
    .find((n) => n.textContent === 'March to Battle')!
    .fire('click');
  expect(starts).toBe(1);
  scene.setPlaybackSpeed(0);
  expect(state).toBe('suspended');
  scene.setPlaybackSpeed(4);
  expect(state).toBe('running');
  tickUntilPhase(scene, 'preparing');
  expect(closes).toBe(1);
});

it.each([
  ['shutdown', ['shutdown']],
  ['destroy', ['destroy']],
  ['shutdown followed by destroy', ['shutdown', 'destroy']],
] as const)(
  'cleans scene resources exactly once on %s',
  (_label, lifecycleEvents) => {
    let closes = 0,
      stoppedLayers = 0;
    const resultHandler = vi.fn(),
      finishedHandler = vi.fn();
    const audio = new BattleAudio(() => ({
      layer: () => ({
        set() {},
        stop() {
          stoppedLayers++;
        },
      }),
      resume() {},
      suspend() {},
      close() {
        closes++;
      },
    }));
    const scene = new BattleScene(undefined, audio);
    scene.create();
    const [left, right] = demoArmies();
    const result = new BattleSession().start(left, right, 626);
    scene.play(result);
    scene.startAudioFromGesture();
    scene.setBattleResultHandler(resultHandler);
    scene.setBattleFinishedHandler(finishedHandler);

    const events = scene.events as unknown as InstanceType<
      typeof boundary.Events
    >;
    for (const event of lifecycleEvents) events.emit(event);

    expect(closes).toBe(1);
    expect(stoppedLayers).toBe(7);
    expect(scene.playback.units).toHaveLength(0);
    expect(scene.playback.counts).toEqual({ left: 0, right: 0 });
    expect(views()).toHaveLength(0);
    expect(events.listenerCount('shutdown')).toBe(0);
    expect(events.listenerCount('destroy')).toBe(0);

    // Cleanup also drops both application callbacks, not merely the pool.
    scene.play(result);
    scene.setPlaybackSpeed(4);
    tickUntilPhase(scene, 'preparing');
    expect(resultHandler).not.toHaveBeenCalled();
    expect(finishedHandler).not.toHaveBeenCalled();
  },
);
function views() {
  return boundary.images.filter((view) => view.active);
}
function tick(scene: BattleScene, milliseconds: number) {
  for (let t = 0; t < milliseconds; t += 50)
    scene.update(0, Math.min(50, milliseconds - t));
}

function tickUntilPhase(scene: BattleScene, phase: BattlePhase): void {
  const timeout = 120_000;
  let elapsed = 0;
  while (scene.playback.phase !== phase && elapsed < timeout) {
    tick(scene, 50);
    elapsed += 50;
  }
  expect(scene.playback.phase).toBe(phase);
}

it('starts every demo soldier behind its gate and fans out continuously only after emergence', () => {
  const scene = boot();
  expect(views()).toHaveLength(82);
  for (const view of views()) {
    expect(view.visible).toBe(true);
    expect([view.x, view.y]).toEqual([view.flipX ? 444 : 34, 147]);
    expect(view.depth).toBeLessThan(400);
    // A cavalry texture is wider than the fourteen-pixel gate. Its initial
    // V2 extends the approach beyond the old gate aperture; the formation
    // anchor must still begin at the cinematic battlefield edge.
    const startX = view.flipX ? 444 : 34;
    expect(Math.abs(view.x - startX)).toBeLessThanOrEqual(10);
  }
  tick(scene, 1800);
  for (const view of views())
    expect([view.x, view.y]).toEqual([view.flipX ? 444 : 34, 147]);
  const previous = new Map(views().map((v) => [v, { x: v.x, y: v.y }]));
  for (let time = 1800; time < 3500; time += 50) {
    tick(scene, 50);
    for (const view of views()) {
      const last = previous.get(view)!;
      expect(Math.hypot(view.x - last.x, view.y - last.y)).toBeLessThanOrEqual(
        5,
      );
      previous.set(view, { x: view.x, y: view.y });
    }
  }
  expect(new Set(views().map((v) => v.y)).size).toBeGreaterThan(5);
  for (const view of views()) expect(view.crop).toEqual({ x: 0, width: 20 });
});

it('preserves the displayed pose when paused on frame one', () => {
  const scene = boot();
  tick(scene, 2050);
  expect(views().some((v) => v.texture.endsWith('-1'))).toBe(true);
  const before = views().map((v) => [v.x, v.y, v.texture, v.flipX]);
  scene.playbackSpeed = 0;
  tick(scene, 500);
  expect(views().map((v) => [v.x, v.y, v.texture, v.flipX])).toEqual(before);
});

it('bounds every living demo sprite update throughout real combat', () => {
  const scene = boot();
  const previous = new Map(views().map((v) => [v, { x: v.x, y: v.y }]));
  while (scene.playback.phase !== 'result') {
    tick(scene, 50);
    for (const unit of scene.playback.units) {
      if (unit.dying) continue;
      const view = boundary.images[799 - unit.id];
      const last = previous.get(view)!;
      expect(Math.hypot(view.x - last.x, view.y - last.y)).toBeLessThanOrEqual(
        5,
      );
      previous.set(view, { x: view.x, y: view.y });
    }
  }
});

it('turns survivors toward their own gate and restores enemy facing on replay', () => {
  const scene = boot();
  while (scene.playback.phase !== 'returning') tick(scene, 50);
  for (const view of views().filter((v) => v.visible))
    expect(view.flipX).toBe(view.texture.startsWith('left-'));
  const [left, right] = demoArmies();
  scene.play(new BattleSession().start(left, right, 626));
  scene.update(0, 0);
  for (const view of views())
    expect(view.flipX).toBe(view.texture.startsWith('right-'));
});

it('launches cross-lane arrows from displayed archers toward displayed targets', () => {
  const scene = boot();
  while (!scene.playback.arrows.some((a) => a.active)) tick(scene, 50);
  const arrow = scene.playback.arrows.find((a) => a.active)!;
  const [left, right] = demoArmies();
  const result = new BattleSession().start(left, right, 626);
  const event = [...result.events].find(
    (e) =>
      e.type === 'attack' &&
      result.initialUnits[e.attackerId - 1].type === 'archer',
  );
  if (event?.type !== 'attack')
    throw new Error('demo must contain archer attacks');
  const displayed = new Map(
    scene.playback.units.map((u, i) => [u.unit.id, boundary.images[799 - i]]),
  );
  const attacker = displayed.get(event.attackerId)!;
  const target = displayed.get(event.targetId)!;
  expect(arrow.from).toEqual({ x: attacker.x, y: attacker.y });
  expect(arrow.to).toEqual({ x: target.x, y: target.y });
  expect(target.y).not.toBe(attacker.y);
  // Actual projectile graphics starts at the displayed bow-height, not merely
  // correct unused metadata in the playback model.
  const projectileLayer = boundary.graphics.find((g) => g.lines.length > 0)!;
  expect(projectileLayer.lines[0].slice(0, 2)).toEqual([
    attacker.x,
    attacker.y - 12,
  ]);
});

it('runs repeated large results through the actual scene with no image creation after 800-view warmup', () => {
  const scene = boot();
  expect(boundary.image).toHaveBeenCalledTimes(800);
  const [left, right] = demoArmies();
  const base = new BattleSession().start(left, right, 626);
  const initialUnits = Array.from({ length: 4000 }, (_, i) => ({
    ...base.initialUnits[i < 2000 ? 0 : 40],
    id: i + 1,
  }));
  const events: BattleEventLog = {
    length: 1_004_001,
    byteLength: 0,
    findTick(tick) {
      return tick > 0 ? this.length : 0;
    },
    at(i): BattleEvent {
      if (i < 1_000_000)
        return {
          type: 'attack',
          tick: 0,
          attackerId: 1,
          targetId: 2001,
          attackerPosition: 0,
          targetPosition: 0,
          damage: 1,
          randomFactor: 1,
        };
      if (i < 1_004_000)
        return {
          type: 'death',
          tick: 0,
          unitId: i - 999999,
          side: i < 1_002_000 ? 'left' : 'right',
          position: 0,
        };
      return { type: 'battle-ended', tick: 0, outcome: 'draw', winner: null };
    },
    [Symbol.iterator](): Iterator<BattleEvent> {
      throw new Error('must stream');
    },
  };
  for (let run = 0; run < 3; run++) {
    scene.play({ ...base, initialUnits, events });
    expect(views()).toHaveLength(800);
    while (scene.playback.phase !== 'preparing') tick(scene, 50);
    expect(views()).toHaveLength(0);
    expect(boundary.image).toHaveBeenCalledTimes(800);
    expect(scene.playback.counts).toEqual({ left: 0, right: 0 });
  }
});
