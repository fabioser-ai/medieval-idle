import { afterEach, expect, it, vi } from 'vitest';
import { SampleSoundscape } from '../../src/game/SampleSoundscape';

afterEach(() => {
  vi.unstubAllGlobals();
});

it('reloads samples and resets loop and event state after stopping a battle', async () => {
  class Parameter {
    value = 1;
    setTargetAtTime(value: number) {
      this.value = value;
    }
  }
  class Source {
    buffer?: AudioBuffer;
    loop = false;
    playbackRate = new Parameter();
    stopped = false;
    connect() {}
    disconnect() {}
    start() {}
    stop() {
      this.stopped = true;
    }
    addEventListener() {}
  }
  class Gain {
    gain = new Parameter();
    connect() {}
    disconnect() {}
  }
  const contexts: Context[] = [];
  let decoded = 0;
  class Context {
    currentTime = 0;
    destination = {};
    sources: Source[] = [];
    constructor() {
      contexts.push(this);
    }
    resume() {
      return Promise.resolve();
    }
    suspend() {
      return Promise.resolve();
    }
    close() {
      return Promise.resolve();
    }
    decodeAudioData() {
      decoded++;
      return Promise.resolve({} as AudioBuffer);
    }
    createBufferSource() {
      const source = new Source();
      this.sources.push(source);
      return source;
    }
    createGain() {
      return new Gain();
    }
  }
  vi.stubGlobal('document', { baseURI: 'https://example.test/game/' });
  vi.stubGlobal('AudioContext', Context);
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(0),
    })),
  );

  const soundscape = new SampleSoundscape();
  const beginBattle = async (time: number, arrows: number, attacks: number) => {
    soundscape.startFromGesture();
    await vi.waitFor(() => expect(decoded).toBe(contexts.length * 12));
    await Promise.resolve();
    soundscape.update({
      phase: 'marching',
      time,
      left: 40,
      right: 40,
      cavalry: 6,
      arrows,
      attacks,
      winner: null,
    });
  };

  await beginBattle(5000, 10, 10);
  expect(contexts[0].sources).toHaveLength(5);
  soundscape.stop();
  expect(
    contexts[0].sources
      .filter((source) => source.loop)
      .every((source) => source.stopped),
  ).toBe(true);

  await beginBattle(0, 1, 1);
  expect(contexts[1].sources).toHaveLength(5);
});

it('discards sample decodes that finish after their audio context was stopped', async () => {
  class Parameter {
    value = 1;
    setTargetAtTime(value: number) {
      this.value = value;
    }
  }
  class Source {
    buffer?: AudioBuffer;
    loop = false;
    playbackRate = new Parameter();
    connect() {}
    disconnect() {}
    start() {}
    stop() {}
    addEventListener() {}
  }
  class Gain {
    gain = new Parameter();
    connect() {}
    disconnect() {}
  }
  let releaseDecode!: (buffer: AudioBuffer) => void;
  const delayedDecode = new Promise<AudioBuffer>((resolve) => {
    releaseDecode = resolve;
  });
  const contexts: Context[] = [];
  class Context {
    currentTime = 0;
    destination = {};
    sources: Source[] = [];
    constructor() {
      contexts.push(this);
    }
    resume() {
      return Promise.resolve();
    }
    suspend() {
      return Promise.resolve();
    }
    close() {
      return Promise.resolve();
    }
    decodeAudioData() {
      return delayedDecode;
    }
    createBufferSource() {
      const source = new Source();
      this.sources.push(source);
      return source;
    }
    createGain() {
      return new Gain();
    }
  }
  let requests = 0;
  vi.stubGlobal('document', { baseURI: 'https://example.test/game/' });
  vi.stubGlobal('AudioContext', Context);
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok: ++requests <= 12,
      arrayBuffer: async () => new ArrayBuffer(0),
    })),
  );

  const soundscape = new SampleSoundscape();
  soundscape.startFromGesture();
  await vi.waitFor(() => expect(requests).toBe(12));
  soundscape.stop();
  soundscape.startFromGesture();
  await vi.waitFor(() => expect(requests).toBe(24));
  releaseDecode({} as AudioBuffer);
  await new Promise((resolve) => setTimeout(resolve, 0));

  soundscape.update({
    phase: 'marching',
    time: 0,
    left: 40,
    right: 40,
    cavalry: 6,
    arrows: 0,
    attacks: 0,
    winner: null,
  });
  expect(contexts[1].sources).toHaveLength(0);
});

it('mixes collective loops and reduces their level with the surviving army', async () => {
  class Parameter {
    value = 1;
    setTargetAtTime(value: number) {
      this.value = value;
    }
  }
  class Gain {
    gain = new Parameter();
    connect() {}
    disconnect() {}
  }
  class Source {
    buffer?: AudioBuffer;
    loop = false;
    playbackRate = new Parameter();
    output?: Gain;
    connect(node: Gain) {
      this.output = node;
    }
    disconnect() {}
    start() {}
    stop() {}
    addEventListener() {}
  }
  const contexts: Context[] = [];
  let decoded = 0;
  class Context {
    currentTime = 0;
    destination = {};
    sources: Source[] = [];
    constructor() {
      contexts.push(this);
    }
    resume() {
      return Promise.resolve();
    }
    suspend() {
      return Promise.resolve();
    }
    close() {
      return Promise.resolve();
    }
    decodeAudioData() {
      decoded++;
      return Promise.resolve({} as AudioBuffer);
    }
    createBufferSource() {
      const source = new Source();
      this.sources.push(source);
      return source;
    }
    createGain() {
      return new Gain();
    }
  }
  vi.stubGlobal('document', { baseURI: 'https://example.test/game/' });
  vi.stubGlobal('AudioContext', Context);
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(0),
    })),
  );

  const soundscape = new SampleSoundscape();
  soundscape.startFromGesture();
  await vi.waitFor(() => expect(decoded).toBe(12));
  await Promise.resolve();
  soundscape.update({
    phase: 'marching',
    time: 1_000,
    left: 50,
    right: 50,
    cavalry: 12,
    arrows: 0,
    attacks: 0,
    winner: null,
  });

  const context = contexts[0];
  const movementLoops = context.sources.filter((source) => source.loop);
  expect(movementLoops).toHaveLength(3);
  const fullStrength = movementLoops.map((source) => source.output!.gain.value);

  soundscape.update({
    phase: 'marching',
    time: 1_500,
    left: 10,
    right: 15,
    cavalry: 12,
    arrows: 0,
    attacks: 0,
    winner: null,
  });
  const depleted = movementLoops.map((source) => source.output!.gain.value);
  depleted.forEach((gain, index) =>
    expect(gain).toBeLessThan(fullStrength[index]),
  );

  soundscape.update({
    phase: 'fighting',
    time: 2_000,
    left: 10,
    right: 15,
    cavalry: 8,
    arrows: 0,
    attacks: 5,
    winner: null,
  });
  expect(context.sources.filter((source) => source.loop)).toHaveLength(4);
  expect(context.sources.filter((source) => !source.loop)).toHaveLength(1);
});
