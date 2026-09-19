import { expect, it } from 'vitest';
import { BattlePlayback } from '../../src/game/BattlePlayback';
import { DeploymentEditor } from '../../src/ui/deployment';
import { BattleController } from '../../src/ui/controls';
import type { PlaybackSpeed } from '../../src/application/battleSession';

function setup() {
  const playback = new BattlePlayback();
  let speed: PlaybackSpeed = 0;
  const editor = new DeploymentEditor({ infantry: { recruit: 10 } });
  const controller = new BattleController(editor, {
    play: (result) => playback.load(result),
    setPlaybackSpeed: (value) => {
      speed = value;
    },
  });
  return { editor, controller, playback, speed: () => speed };
}
it('refuses empty preparation without starting playback or locking valid future edits', () => {
  const { controller, editor, playback } = setup();
  expect(() => controller.start()).toThrow(/at least one/i);
  expect(playback.phase).toBe('preparing');
  editor.assign('front', 'infantry', 'recruit', 4);
  controller.start();
  expect(playback.counts.left).toBe(4);
});
it('locks strategy once, starts the chosen army, and exposes only speed to the viewing controls', () => {
  const { controller, editor, playback, speed } = setup();
  editor.assign('front', 'infantry', 'recruit', 7);
  controller.start();
  expect(playback.counts.left).toBe(7);
  expect(playback.phase).toBe('gates');
  expect(Object.keys(controller.viewing)).toEqual(['setPlaybackSpeed']);
  expect(Object.isFrozen(controller.viewing)).toBe(true);
  expect(() => editor.assign('front', 'infantry', 'recruit', 1)).toThrow(
    /locked/,
  );
  expect(() => controller.start()).toThrow(/already/i);
  const units = playback.units.map((u) => u.unit);
  for (const value of [0, 1, 2, 4] as const) {
    controller.viewing.setPlaybackSpeed(value);
    expect(speed()).toBe(value);
    expect(playback.time).toBe(0);
    expect(playback.units.map((u) => u.unit)).toEqual(units);
  }
  expect(() => controller.viewing.setPlaybackSpeed(3 as never)).toThrow(
    /speed/,
  );
});
it('does not enable viewing control calls before deployment is locked', () => {
  const { controller, speed } = setup();
  expect(() => controller.viewing.setPlaybackSpeed(4)).toThrow(/start/i);
  expect(speed()).toBe(0);
});
