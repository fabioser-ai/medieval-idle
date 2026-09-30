import type { BattlePhase } from '../application/battleSession';
import type { AudioFrame } from './BattleAudio';

type SoundRole =
  | 'march'
  | 'drums'
  | 'cavalry'
  | 'horn'
  | 'arrows'
  | 'impact'
  | 'melee'
  | 'result';

type LoopRole = 'march' | 'drums' | 'melee';
type LoopVoice = { source: AudioBufferSourceNode; gain: GainNode };

const FILES: Record<SoundRole, readonly string[]> = {
  march: ['/audio/v2/march-1.ogg', '/audio/v2/march-2.ogg'],
  drums: ['/audio/v2/drums-loop.ogg'],
  cavalry: ['/audio/v2/cavalry-loop.ogg'],
  horn: ['/audio/v2/horn-charge.ogg'],
  arrows: ['/audio/v2/arrows-1.ogg', '/audio/v2/arrows-2.ogg'],
  impact: ['/audio/v2/impact-1.ogg', '/audio/v2/impact-2.ogg'],
  melee: ['/audio/v2/melee-1.ogg', '/audio/v2/melee-2.ogg'],
  result: ['/audio/v2/result.ogg'],
};

const base = (path: string): string =>
  new URL(path.replace(/^\//, ''), document.baseURI).toString();

export class SampleSoundscape {
  private context?: AudioContext;
  private buffers = new Map<string, AudioBuffer>();
  private lastPhase?: BattlePhase;
  private lastArrowCount = 0;
  private lastAttackCount = 0;
  private lastImpactAt = Number.NEGATIVE_INFINITY;
  private peakTroops = 0;
  private cavalry?: { source: AudioBufferSourceNode; gain: GainNode };
  private loops: Partial<Record<LoopRole, LoopVoice>> = {};
  private loading?: Promise<void>;

  startFromGesture(): void {
    if (
      typeof globalThis.AudioContext === 'undefined' ||
      typeof fetch === 'undefined'
    )
      return;
    this.context ??= new AudioContext();
    void this.context.resume().catch(() => {});
    this.loading ??= this.load();
  }

  setPaused(paused: boolean): void {
    if (!this.context) return;
    void (paused ? this.context.suspend() : this.context.resume()).catch(
      () => {},
    );
  }

  update(frame: AudioFrame): void {
    const context = this.context;
    if (!context || !this.buffers.size) return;
    const phaseChanged = frame.phase !== this.lastPhase;
    if (phaseChanged) this.onPhase(frame);

    const troops = Math.max(0, frame.left + frame.right);
    this.peakTroops = Math.max(this.peakTroops, troops);
    const mass = this.peakTroops ? Math.sqrt(troops / this.peakTroops) : 0;
    const moving = ['marching', 'charging', 'returning'].includes(frame.phase);
    this.setLoop(
      'march',
      moving ? (frame.phase === 'charging' ? 0.22 : 0.13) * mass : 0,
      frame.phase === 'charging' ? 1.12 : 0.94,
    );

    const cavalryGain =
      moving && frame.cavalry > 0
        ? Math.min(0.34, 0.08 + frame.cavalry / 80) *
          (frame.phase === 'charging' ? 1.35 : 1) *
          mass
        : 0;
    this.setCavalry(cavalryGain, frame.phase === 'charging' ? 1.18 : 0.94);
    const drumGain = moving
      ? frame.phase === 'charging'
        ? 0.28
        : 0.13
      : frame.phase === 'fighting'
        ? 0.08
        : 0;
    this.setLoop(
      'drums',
      drumGain * mass,
      frame.phase === 'charging' ? 1.12 : 0.96,
    );
    this.setLoop(
      'melee',
      frame.phase === 'fighting'
        ? Math.min(0.18, 0.04 + frame.attacks * 0.012) * mass
        : 0,
      0.96,
    );

    if (frame.arrows > this.lastArrowCount)
      this.oneShot('arrows', 0.24 * mass, 0.94, 1.06);
    if (
      frame.attacks > this.lastAttackCount &&
      frame.time - this.lastImpactAt >= 240
    ) {
      this.lastImpactAt = frame.time;
      this.oneShot('impact', 0.16 * mass, 0.92, 1.06);
    }
    this.lastArrowCount = frame.arrows;
    this.lastAttackCount = frame.attacks;
    this.lastPhase = frame.phase;
  }

  stop(): void {
    this.cavalry?.source.stop();
    Object.values(this.loops).forEach((loop) => loop.source.stop());
    this.cavalry = undefined;
    this.loops = {};
    if (this.context) void this.context.close().catch(() => {});
    this.context = undefined;
    this.buffers.clear();
    this.loading = undefined;
    this.lastPhase = undefined;
    this.lastArrowCount = 0;
    this.lastAttackCount = 0;
    this.lastImpactAt = Number.NEGATIVE_INFINITY;
    this.peakTroops = 0;
  }

  private async load(): Promise<void> {
    const context = this.context;
    if (!context) return;
    await Promise.all(
      Object.values(FILES)
        .flat()
        .map(async (path) => {
          try {
            const response = await fetch(base(path));
            if (!response.ok) return;
            const buffer = await context.decodeAudioData(
              await response.arrayBuffer(),
            );
            if (this.context === context) this.buffers.set(path, buffer);
          } catch {
            // Missing/unsupported samples are intentionally silent; synth fallback remains.
          }
        }),
    );
  }

  private onPhase(frame: AudioFrame): void {
    if (frame.phase === 'charging') this.oneShot('horn', 0.42, 0.98, 1.02);
    if (frame.phase === 'fighting') {
      this.lastImpactAt = frame.time;
      this.oneShot('impact', 0.46, 0.94, 1.02);
    }
    if (frame.phase === 'result') {
      this.setCavalry(0, 1);
      this.setLoop('march', 0, 1);
      this.setLoop('drums', 0, 1);
      this.setLoop('melee', 0, 1);
      this.oneShot('result', 0.36, 1, 1);
    }
  }

  private oneShot(
    role: SoundRole,
    gainValue: number,
    lowRate: number,
    highRate: number,
  ): void {
    const context = this.context;
    if (!context) return;
    const candidates = FILES[role].filter((path) => this.buffers.has(path));
    if (!candidates.length) return;
    const path = candidates[Math.floor(Math.random() * candidates.length)];
    const source = context.createBufferSource();
    const gain = context.createGain();
    source.buffer = this.buffers.get(path)!;
    source.playbackRate.value = lowRate + Math.random() * (highRate - lowRate);
    gain.gain.value = gainValue * (0.86 + Math.random() * 0.28);
    source.connect(gain);
    gain.connect(context.destination);
    source.start();
    source.addEventListener('ended', () => {
      source.disconnect();
      gain.disconnect();
    });
  }

  private setLoop(role: LoopRole, volume: number, rate: number): void {
    const context = this.context;
    if (!context) return;
    let loop = this.loops[role];
    if (!loop && volume > 0) {
      const candidates = FILES[role].filter((path) => this.buffers.has(path));
      if (!candidates.length) return;
      const path = candidates[Math.floor(Math.random() * candidates.length)];
      const source = context.createBufferSource();
      const gain = context.createGain();
      source.buffer = this.buffers.get(path)!;
      source.loop = true;
      gain.gain.value = 0;
      source.connect(gain);
      gain.connect(context.destination);
      source.start();
      loop = { source, gain };
      this.loops[role] = loop;
    }
    if (!loop) return;
    const now = context.currentTime;
    loop.source.playbackRate.setTargetAtTime(rate, now, 0.2);
    loop.gain.gain.setTargetAtTime(volume, now, 0.3);
  }

  private setCavalry(volume: number, rate: number): void {
    const context = this.context;
    if (!context) return;
    if (!this.cavalry && volume > 0) {
      const buffer = this.buffers.get(FILES.cavalry[0]);
      if (!buffer) return;
      const source = context.createBufferSource();
      const gain = context.createGain();
      source.buffer = buffer;
      source.loop = true;
      gain.gain.value = 0;
      source.connect(gain);
      gain.connect(context.destination);
      source.start();
      this.cavalry = { source, gain };
    }
    if (!this.cavalry) return;
    const now = context.currentTime;
    this.cavalry.source.playbackRate.setTargetAtTime(rate, now, 0.12);
    this.cavalry.gain.gain.setTargetAtTime(volume, now, 0.18);
  }
}
