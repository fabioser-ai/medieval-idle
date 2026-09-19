import type { BattlePhase } from '../application/battleSession';

export interface AudioLayer {
  set(gain: number, frequency: number): void;
  stop(): void;
}
export interface AudioEngine {
  layer(index: number): AudioLayer;
  resume(): void;
  suspend(): void;
  close(): void;
}
export interface AudioFrame {
  phase: BattlePhase;
  time: number;
  left: number;
  right: number;
  cavalry: number;
  arrows: number;
  attacks: number;
  winner: 'left' | 'right' | null;
}

/** Seven persistent oscillators/gain envelopes, never one sound per soldier.
 * No timer or simulation clock: the renderer supplies cinematic time. */
export class BattleAudio {
  private engine?: AudioEngine;
  private layers: AudioLayer[] = [];
  constructor(
    private readonly factory: () => AudioEngine | undefined = webAudioEngine,
  ) {}
  startFromGesture(): void {
    if (this.engine) return;
    try {
      this.engine = this.factory();
      if (!this.engine) return;
      for (let i = 0; i < 7; i++) this.layers.push(this.engine.layer(i));
      this.engine.resume();
    } catch {
      this.stop();
    }
  }
  setPaused(paused: boolean): void {
    if (paused) this.engine?.suspend();
    else this.engine?.resume();
  }
  update(frame: AudioFrame): void {
    if (!this.engine) return;
    const { phase, time } = frame;
    const moving = ['marching', 'charging', 'fighting', 'returning'].includes(
      phase,
    );
    const density = Math.min(
      1,
      Math.sqrt(Math.max(0, frame.left + frame.right)) / 20,
    );
    const pulse =
      0.4 +
      0.6 * Math.pow(Math.sin(time / (phase === 'charging' ? 50 : 100)), 2);
    const march = 0.025 * density * pulse;
    const steps = moving ? march * (phase === 'charging' ? 2 : 1) : 0;
    const fighting = phase === 'fighting';
    const values: [number, number][] = [
      [phase === 'gates' ? 0.045 : 0, 70 + 30 * Math.sin(time / 130)],
      [steps, 85],
      [moving ? steps * Math.min(1, frame.cavalry / 12) : 0, 55],
      [
        fighting ? Math.min(0.035, frame.arrows * 0.004) : 0,
        1100 + 250 * Math.sin(time / 80),
      ],
      [fighting ? Math.min(0.025, frame.arrows * 0.003) * pulse : 0, 190],
      [
        fighting ? Math.min(0.04, frame.attacks * 0.002) * pulse : 0,
        130 + 70 * Math.sin(time / 31),
      ],
      [
        phase === 'result' ? 0.045 : 0,
        frame.winner === 'left'
          ? 523.25
          : frame.winner === 'right'
            ? 196
            : 261.63,
      ],
    ];
    values.forEach(([gain, frequency], i) =>
      this.layers[i].set(gain, frequency),
    );
  }
  stop(): void {
    for (const layer of this.layers) layer.stop();
    this.layers = [];
    this.engine?.close();
    this.engine = undefined;
  }
}

/** The only browser boundary. Rejections (autoplay/device policy) are silent. */
export function webAudioEngine(): AudioEngine | undefined {
  if (typeof globalThis.AudioContext === 'undefined') return undefined;
  const context = new AudioContext();
  const ignore = (promise: Promise<void>) => {
    void promise.catch(() => {});
  };
  return {
    layer(index) {
      const oscillator = context.createOscillator(),
        gain = context.createGain();
      oscillator.type = (
        [
          'sawtooth',
          'triangle',
          'square',
          'sawtooth',
          'triangle',
          'square',
          'sine',
        ] as OscillatorType[]
      )[index];
      gain.gain.value = 0;
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start();
      return {
        set(volume, frequency) {
          const now = context.currentTime;
          gain.gain.cancelScheduledValues(now);
          gain.gain.setTargetAtTime(volume, now, 0.025);
          oscillator.frequency.cancelScheduledValues(now);
          oscillator.frequency.setTargetAtTime(frequency, now, 0.02);
        },
        stop() {
          oscillator.stop();
          oscillator.disconnect();
          gain.disconnect();
        },
      };
    },
    resume() {
      ignore(context.resume());
    },
    suspend() {
      ignore(context.suspend());
    },
    close() {
      ignore(context.close());
    },
  };
}
