import { createRequire } from 'node:module';
import { expect, it, vi } from 'vitest';

const phaserBoundary = vi.hoisted(() => ({
  configs: [] as unknown[],
}));

vi.mock('phaser', () => ({
  default: {
    AUTO: 'auto',
    Scale: { FIT: 'fit', CENTER_BOTH: 'center-both' },
    Scene: class {},
    Scenes: { Events: { SHUTDOWN: 'shutdown', DESTROY: 'destroy' } },
    Game: class {
      constructor(config: unknown) {
        phaserBoundary.configs.push(config);
      }
    },
  },
}));

import { createGame } from '../../src/game/config';

it('boots with Phaser audio disabled and leaves AudioContext ownership to the battle gesture', () => {
  let contexts = 0;
  vi.stubGlobal(
    'AudioContext',
    class {
      constructor() {
        contexts++;
      }
    },
  );
  phaserBoundary.configs.length = 0;

  createGame({} as HTMLElement);

  const config = phaserBoundary.configs[0] as {
    audio: { noAudio?: boolean };
  };
  expect(config.audio).toEqual({ noAudio: true });

  // Exercise Phaser 3.90's installed manager selection with our boot config.
  // With noAudio it must choose the inert manager without touching Web Audio.
  const require = createRequire(import.meta.url);
  const creator = require('phaser/src/sound/SoundManagerCreator.js') as {
    create(game: {
      config: { audio: { noAudio?: boolean } };
      device: { audio: { webAudio: boolean; audioData: boolean } };
    }): { constructor: { name: string } };
  };
  const manager = creator.create({
    config: { audio: config.audio },
    device: { audio: { webAudio: true, audioData: true } },
  });
  expect(manager.constructor.name).toBe('NoAudioSoundManager');
  expect(contexts).toBe(0);
  vi.unstubAllGlobals();
});
