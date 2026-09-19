import { expect, it, vi } from 'vitest';
import { BattleAudio, type AudioEngine } from '../../src/game/BattleAudio';

function harness() {
  const engines: {
    channels: { gain: number; frequency: number; stopped: boolean }[];
    state: string;
  }[] = [];
  const audio = new BattleAudio((): AudioEngine => {
    const engine = {
      channels: [] as { gain: number; frequency: number; stopped: boolean }[],
      state: 'suspended',
    };
    engines.push(engine);
    return {
      layer() {
        const channel = { gain: 0, frequency: 0, stopped: false };
        engine.channels.push(channel);
        return {
          set(gain, frequency) {
            channel.gain = gain;
            channel.frequency = frequency;
          },
          stop() {
            channel.stopped = true;
          },
        };
      },
      resume() {
        engine.state = 'running';
      },
      suspend() {
        engine.state = 'suspended';
      },
      close() {
        engine.state = 'closed';
      },
    };
  });
  return { audio, engines };
}

it('wires the actual Web Audio adapter with bounded automation and disconnects every native node', async () => {
  // Only native audio I/O is replaced; BattleAudio and webAudioEngine both run.
  class Parameter {
    value = 0;
    pending = 0;
    cancelScheduledValues() {
      this.pending = 0;
    }
    setTargetAtTime(value: number) {
      this.value = value;
      this.pending++;
    }
  }
  class Node {
    type = 'sine';
    gain = new Parameter();
    frequency = new Parameter();
    connected = false;
    started = false;
    stopped = false;
    connect() {
      this.connected = true;
    }
    disconnect() {
      this.connected = false;
    }
    start() {
      this.started = true;
    }
    stop() {
      if (!this.started) throw Error('not started');
      this.stopped = true;
    }
  }
  const contexts: Context[] = [];
  class Context {
    currentTime = 0;
    destination = {};
    oscillators: Node[] = [];
    gains: Node[] = [];
    closed = false;
    constructor() {
      contexts.push(this);
    }
    createOscillator() {
      const node = new Node();
      this.oscillators.push(node);
      return node;
    }
    createGain() {
      const node = new Node();
      this.gains.push(node);
      return node;
    }
    resume() {
      return Promise.reject(new Error('autoplay blocked'));
    }
    suspend() {
      return Promise.resolve();
    }
    close() {
      this.closed = true;
      return Promise.resolve();
    }
  }
  vi.stubGlobal('AudioContext', Context);
  try {
    const audio = new BattleAudio();
    expect(contexts).toHaveLength(0);
    for (let battle = 0; battle < 3; battle++) {
      audio.startFromGesture();
      const context = contexts.filter((candidate) => candidate.oscillators.length > 0)[battle];
      expect(context.oscillators).toHaveLength(7);
      expect(context.gains).toHaveLength(7);
      for (let time = 0; time < 1000; time += 10)
        audio.update({
          phase: 'fighting',
          time,
          left: 400,
          right: 400,
          cavalry: 40,
          arrows: 10,
          attacks: 40,
          winner: null,
        });
      expect(
        context.oscillators.every(
          (n) => n.started && n.connected && n.frequency.pending === 1,
        ),
      ).toBe(true);
      expect(
        context.gains.every((n) => n.connected && n.gain.pending === 1),
      ).toBe(true);
      audio.setPaused(true);
      audio.setPaused(false);
      audio.stop();
      expect(context.closed).toBe(true);
      expect(context.oscillators.every((n) => n.stopped && !n.connected)).toBe(
        true,
      );
      expect(context.gains.every((n) => !n.connected)).toBe(true);
    }
    await Promise.resolve(); // Rejected native resume promises must be handled.
  } finally {
    vi.unstubAllGlobals();
  }
});
it('allocates nothing before gesture; uses seven shared layers even for 4000 soldiers', () => {
  const { audio, engines } = harness();
  audio.update({
    phase: 'marching',
    time: 2000,
    left: 2000,
    right: 2000,
    cavalry: 1000,
    arrows: 64,
    attacks: 800,
    winner: null,
  });
  expect(engines).toHaveLength(0);
  audio.startFromGesture();
  audio.startFromGesture();
  expect(engines).toHaveLength(1);
  expect(engines[0].channels).toHaveLength(7);
  audio.update({
    phase: 'marching',
    time: 2000,
    left: 2000,
    right: 2000,
    cavalry: 1000,
    arrows: 64,
    attacks: 800,
    winner: null,
  });
  const march = engines[0].channels[1].gain;
  audio.update({
    phase: 'charging',
    time: 2000,
    left: 2000,
    right: 2000,
    cavalry: 1000,
    arrows: 64,
    attacks: 800,
    winner: null,
  });
  expect(engines[0].channels[1].gain).toBeGreaterThan(march);
  expect(engines[0].channels.every((c) => c.gain >= 0 && c.gain <= 0.15)).toBe(
    true,
  );
});
it('drives gate, movement, arrows, melee and result voices then silences at rest', () => {
  const { audio, engines } = harness();
  audio.startFromGesture();
  const frame = {
    phase: 'gates' as const,
    time: 200,
    left: 40,
    right: 40,
    cavalry: 6,
    arrows: 5,
    attacks: 20,
    winner: 'left' as const,
  };
  audio.update(frame);
  expect(engines[0].channels[0].gain).toBeGreaterThan(0);
  audio.update({ ...frame, phase: 'fighting' });
  for (const i of [1, 2, 3, 4, 5])
    expect(engines[0].channels[i].gain).toBeGreaterThan(0);
  audio.update({ ...frame, phase: 'result' });
  expect(engines[0].channels[6].gain).toBeGreaterThan(0);
  audio.update({ ...frame, phase: 'preparing' });
  expect(engines[0].channels.every((c) => c.gain === 0)).toBe(true);
});
it('suspends on pause and stops/disconnects all voices on repeat battles', () => {
  const { audio, engines } = harness();
  for (let i = 0; i < 3; i++) {
    audio.startFromGesture();
    audio.setPaused(true);
    expect(engines[i].state).toBe('suspended');
    audio.setPaused(false);
    expect(engines[i].state).toBe('running');
    audio.stop();
    audio.stop();
    expect(engines[i].state).toBe('closed');
    expect(engines[i].channels.every((c) => c.stopped)).toBe(true);
  }
});
it('is harmless when Web Audio is absent or unavailable', () => {
  for (const factory of [
    () => undefined,
    () => {
      throw new Error('blocked');
    },
  ]) {
    const audio = new BattleAudio(factory);
    expect(() => {
      audio.startFromGesture();
      audio.setPaused(true);
      audio.stop();
    }).not.toThrow();
  }
});
