import { expect, it } from 'vitest';
import { ElementBoundary } from '../domBoundary';
import { mountDeployment } from '../../src/ui/deploymentView';
import { BattlePlayback } from '../../src/game/BattlePlayback';
import type { PlaybackSpeed } from '../../src/application/battleSession';

it('renders all five labeled groups, exact inventory, one status, and blocks invalid edits', () => {
  const host = new ElementBoundary('div');
  mountDeployment(host as unknown as HTMLElement, {
    play() {},
    setPlaybackSpeed() {},
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
  expect(speed).toBe(1);
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
  const buttons = viewing.all().filter((n) => n.tag === 'button');
  expect(buttons.map((n) => n.textContent)).toEqual([
    'Pause',
    '1×',
    '2×',
    '4×',
  ]);
  expect(buttons[0].focused).toBe(true);
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
