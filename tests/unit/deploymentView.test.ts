import { expect, it } from 'vitest';
import { ElementBoundary } from '../domBoundary';
import { mountDeployment } from '../../src/ui/deploymentView';
import { BattlePlayback } from '../../src/game/BattlePlayback';
import type { PlaybackSpeed } from '../../src/application/battleSession';
import { Campaign } from '../../src/application/campaign';
import { SaveStore } from '../../src/application/saveStore';
import { formationDuel } from '../../src/game/acceptanceScenarios';

it('selects a developer preset explicitly, labels the fixed opponent, and prefills valid deployment', () => {
  const host = new ElementBoundary('div');
  const campaign = new Campaign(
    new SaveStore({ getItem: () => null, setItem() {} }),
  );
  mountDeployment(
    host as unknown as HTMLElement,
    { play() {}, setPlaybackSpeed() {}, setBattleFinishedHandler() {} },
    { campaign, developer: true },
  );
  const select = host
    .all()
    .find((n) => n.attributes['aria-label'] === 'Acceptance preset')!;
  select.value = 'archer-rear';
  select.fire('change');
  expect(campaign.inventory.archer?.trained).toBe(5);
  expect(
    host.all().find((n) => n.attributes['aria-label'] === 'Rear quantity')!
      .value,
  ).toBe('5');
  expect(host.all().find((n) => n.textContent === 'To Battle')!.disabled).toBe(
    false,
  );
  expect(
    host
      .all()
      .some((n) =>
        n.textContent.includes(
          'You command Alderwatch (blue, left). Fixed opponent: Emberfall (red, right)',
        ),
      ),
  ).toBe(true);
  expect(Object.keys(select.listeners)).toHaveLength(0);
  expect(
    host.all().find((n) => n.attributes['aria-label'] === 'Acceptance preset')!
      .value,
  ).toBe('');
});

it('returns focus to a visible developer summary after battle remount', () => {
  const host = new ElementBoundary('div');
  let finish = () => {};
  mountDeployment(
    host as unknown as HTMLElement,
    {
      play() {},
      setPlaybackSpeed() {},
      setBattleFinishedHandler(handler) {
        finish = handler;
      },
    },
    { developer: true },
  );

  finish();

  const summary = host
    .all()
    .find((node) => node.textContent === 'Developer acceptance presets')!;
  const collapsedSelect = host
    .all()
    .find((node) => node.attributes['aria-label'] === 'Acceptance preset')!;
  expect(summary.focused).toBe(true);
  expect(collapsedSelect.focused).toBe(false);
});

it('blocks UI-thread deployments beyond 240 even when a loaded campaign contains more troops', () => {
  const host = new ElementBoundary('div'),
    campaign = new Campaign(
      new SaveStore({ getItem: () => null, setItem() {} }),
    );
  const preset = formationDuel('rear');
  campaign.reset({
    ...preset.left,
    groups: [
      {
        slot: 'rear',
        cohorts: [{ type: 'archer', tier: 'trained', count: 2000 }],
      },
    ],
  });
  mountDeployment(
    host as unknown as HTMLElement,
    { play() {}, setPlaybackSpeed() {}, setBattleFinishedHandler() {} },
    { campaign },
  );
  for (const [label, value] of [
    ['Rear unit type', 'archer'],
    ['Rear recruit %', '0'],
    ['Rear trained %', '100'],
    ['Rear quantity', '2000'],
  ]) {
    const field = host.all().find((n) => n.attributes['aria-label'] === label)!;
    field.value = value;
    field.fire(field.tag === 'select' ? 'change' : 'input');
  }
  expect(host.all().find((n) => n.textContent === 'To Battle')!.disabled).toBe(
    true,
  );
  expect(
    host.all().find((n) => n.id === 'deployment-status')!.textContent,
  ).toMatch(/240/);
});

it('renders all five labeled groups, exact inventory, one status, and blocks invalid edits', () => {
  const host = new ElementBoundary('div');
  mountDeployment(host as unknown as HTMLElement, {
    play() {},
    setPlaybackSpeed() {},
    setBattleFinishedHandler() {},
  });
  const all = host.all();
  expect(all.filter((n) => n.tag === 'fieldset')).toHaveLength(5);
  expect(all.filter((n) => n.tag === 'select')).toHaveLength(5);
  expect(all.filter((n) => n.tag === 'input')).toHaveLength(25);
  expect(
    all
      .filter((n) => n.tag === 'input' || n.tag === 'select')
      .every((n) => n.attributes['aria-label']),
  ).toBe(true);
  const status = all.filter((n) => n.attributes.role === 'status');
  expect(status).toHaveLength(1);
  const start = all.find((n) => n.textContent === 'To Battle')!;
  expect(start.disabled).toBe(true);
  const quantity = all.find(
    (n) => n.attributes['aria-label'] === 'Front quantity',
  )!;
  quantity.value = '-1';
  quantity.fire('input');
  expect(status[0].textContent).toMatch(/Front quantity/);
  expect(start.disabled).toBe(true);
  quantity.value = '3';
  quantity.fire('input');
  expect(start.disabled).toBe(false);
  expect(all.find((n) => n.id === 'inventory-infantry')!.textContent).toContain(
    'Recruit 9',
  );
  quantity.value = '';
  quantity.fire('input');
  expect(start.disabled).toBe(true);
});

it('starts the selected formations, disables/hides every strategy input, focuses viewing controls, and changes only rendering speed', () => {
  const host = new ElementBoundary('div');
  const playback = new BattlePlayback();
  let speed: PlaybackSpeed = 0;
  mountDeployment(host as unknown as HTMLElement, {
    play: (result) => playback.load(result),
    setPlaybackSpeed: (value) => {
      speed = value;
    },
    setBattleFinishedHandler() {},
  });
  const all = host.all();
  for (const [label, value] of [
    ['Front quantity', '4'],
    ['Rear quantity', '3'],
    ['Rear unit type', 'archer'],
  ]) {
    const input = all.find((n) => n.attributes['aria-label'] === label)!;
    expect(input).toBeDefined();
    input.value = value;
    input.fire(input.tag === 'select' ? 'change' : 'input');
  }
  all.find((n) => n.textContent === 'To Battle')!.fire('click');
  expect(playback.counts.left).toBe(7);
  expect(speed).toBe(4);
  expect(
    all.find((n) => n.attributes['aria-label'] === 'Deploy your army')!.hidden,
  ).toBe(true);
  expect(
    all
      .filter((n) => n.tag === 'input' || n.tag === 'select')
      .every((n) => n.disabled),
  ).toBe(true);
  const viewing = all.find(
    (n) => n.attributes['aria-label'] === 'Battle playback',
  )!;
  expect(viewing.hidden).toBe(false);
  expect(host.className).toBe('battle-ui viewing');
  const buttons = viewing.all().filter((n) => n.tag === 'button');
  expect(buttons.map((n) => n.textContent)).toEqual([
    'Pause',
    '1×',
    '2×',
    '4×',
  ]);
  expect(buttons[0].focused).toBe(true);
  expect(buttons.map((n) => n.attributes['aria-pressed'])).toEqual([
    'false',
    'false',
    'false',
    'true',
  ]);
  expect(
    all.find((n) => n.attributes.role === 'status')!.textContent,
  ).toContain('Viewing at 4×');
  buttons[0].fire('click');
  expect(speed).toBe(0);
  expect(all.find((n) => n.attributes.role === 'status')!.textContent).toMatch(
    /Paused/,
  );
  buttons[3].fire('click');
  expect(speed).toBe(4);
  expect(buttons.map((n) => n.attributes['aria-pressed'])).toEqual([
    'false',
    'false',
    'false',
    'true',
  ]);
  expect(playback.time).toBe(0);
  expect(playback.counts.left).toBe(7);
});

it('offers recovery only for a depleted campaign, requires confirmation, and remounts a playable saved roster', () => {
  const data = new Map<string, string>();
  const store = new SaveStore({
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
  });
  const campaign = new Campaign(store);
  campaign.reset({ ...formationDuel('rear').left, groups: [] });
  const depleted = JSON.stringify(campaign.data);
  const host = new ElementBoundary('div');
  const playback = new BattlePlayback();
  const renderer = {
    play: (result: Parameters<BattlePlayback['load']>[0]) =>
      playback.load(result),
    setPlaybackSpeed() {},
    setBattleFinishedHandler() {},
  };
  const button = (label: string) =>
    host.all().find((n) => n.textContent === label);
  mountDeployment(host as unknown as HTMLElement, renderer, { campaign });
  expect(button('Start new campaign')).toBeDefined();
  button('Start new campaign')!.fire('click');
  expect(JSON.stringify(campaign.data)).toBe(depleted);
  expect(
    host
      .all()
      .some((n) =>
        /replace.*campaign.*initial prototype roster/i.test(n.textContent),
      ),
  ).toBe(true);
  button('Cancel')!.fire('click');
  expect(JSON.stringify(new Campaign(store).data)).toBe(depleted);
  expect(button('Start new campaign')!.focused).toBe(true);
  button('Start new campaign')!.fire('click');
  button('Confirm new campaign')!.fire('click');
  expect(button('Start new campaign')).toBeUndefined();
  expect(new Campaign(store).inventory.infantry?.recruit).toBe(12);
  expect(data.get('medieval-idle.save.backup')).toBe(depleted);
  expect(campaign.data.lastResult).toBeNull();
  expect(campaign.data.lastSeed).toBeNull();
  const quantity = host
    .all()
    .find((n) => n.attributes['aria-label'] === 'Front quantity')!;
  quantity.value = '4';
  quantity.fire('input');
  expect(button('To Battle')!.disabled).toBe(false);
  button('To Battle')!.fire('click');
  expect(playback.counts.left).toBe(4);
});

it('does not offer campaign replacement merely because deployment is empty or all reserves are assigned', () => {
  const host = new ElementBoundary('div');
  const campaign = new Campaign(
    new SaveStore({ getItem: () => null, setItem() {} }),
  );
  campaign.reset({
    ...formationDuel('rear').left,
    groups: [
      {
        slot: 'front',
        cohorts: [{ type: 'infantry', tier: 'recruit', count: 1 }],
      },
    ],
  });
  mountDeployment(
    host as unknown as HTMLElement,
    { play() {}, setPlaybackSpeed() {}, setBattleFinishedHandler() {} },
    { campaign },
  );
  expect(host.all().some((n) => n.textContent === 'Start new campaign')).toBe(
    false,
  );
  const quantity = host
    .all()
    .find((n) => n.attributes['aria-label'] === 'Front quantity')!;
  quantity.value = '1';
  quantity.fire('input');
  expect(
    host.all().find((n) => n.id === 'inventory-infantry')!.textContent,
  ).toContain('Recruit 0');
  expect(host.all().some((n) => n.textContent === 'Start new campaign')).toBe(
    false,
  );
});
