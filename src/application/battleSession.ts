import type { ArmyDeployment } from '../domain/army';
import type { BattleResult } from '../domain/battleEvents';
import { simulateBattle, SIMULATION_TUNING } from '../domain/battleSimulation';

export type BattlePhase =
  | 'preparing'
  | 'gates'
  | 'marching'
  | 'charging'
  | 'fighting'
  | 'result'
  | 'returning';
export type PlaybackSpeed = 0 | 1 | 2 | 4;

/** Owns only the current replay. Synchronous simulation is NOT maximum-size/mobile ready. */
export class BattleSession {
  #result: BattleResult | null = null;
  #phase: BattlePhase = 'preparing';
  #tick = 0;
  #speed: PlaybackSpeed = 1;
  #cursor = 0;

  constructor(
    private readonly simulate: (
      left: ArmyDeployment,
      right: ArmyDeployment,
      seed: number,
    ) => BattleResult = simulateBattle,
  ) {}

  get result(): BattleResult | null {
    return this.#result;
  }
  get phase(): BattlePhase {
    return this.#phase;
  }
  get playbackTick(): number {
    return this.#tick;
  }
  get playbackSpeed(): PlaybackSpeed {
    return this.#speed;
  }
  get eventCursor(): number {
    return this.#cursor;
  }

  start(
    left: ArmyDeployment,
    right: ArmyDeployment,
    seed: number,
  ): BattleResult {
    // Release before allocating the next result; a failed start leaves preparation state.
    this.#result = null;
    this.#phase = 'preparing';
    this.#tick = 0;
    this.#cursor = 0;
    this.#result = this.simulate(left, right, seed);
    this.#phase = 'gates';
    return this.#result;
  }

  setPlaybackSpeed(speed: PlaybackSpeed): void {
    if (![0, 1, 2, 4].includes(speed))
      throw new RangeError('Invalid playback speed.');
    this.#speed = speed;
  }

  /** Deterministic wall-clock delta in milliseconds; no timers or event-log arrays. */
  advance(milliseconds: number): void {
    if (!Number.isFinite(milliseconds) || milliseconds < 0)
      throw new RangeError('Invalid playback delta.');
    if (
      !this.#result ||
      this.#speed === 0 ||
      this.#phase === 'result' ||
      this.#phase === 'returning'
    )
      return;
    this.#tick = Math.min(
      this.#result.durationTicks,
      this.#tick +
        (milliseconds * this.#speed * SIMULATION_TUNING.ticksPerSecond) / 1000,
    );
    while (this.#cursor < this.#result.events.length) {
      const event = this.#result.events.at(this.#cursor)!;
      if (event.tick > this.#tick) break;
      this.#cursor += 1;
      switch (event.type) {
        case 'gate-opened':
          this.#phase = 'gates';
          break;
        case 'march-started':
          this.#phase = 'marching';
          break;
        case 'charge-started':
          if (this.#phase !== 'fighting') this.#phase = 'charging';
          break;
        case 'attack':
          this.#phase = 'fighting';
          break;
        case 'battle-ended':
          this.#phase = 'result';
          break;
      }
    }
  }

  beginReturn(): void {
    if (this.#phase !== 'result')
      throw new Error('Return requires a finished replay.');
    this.#phase = 'returning';
  }

  finishReturn(): void {
    if (this.#phase !== 'returning')
      throw new Error('No return is in progress.');
    this.#result = null;
    this.#phase = 'preparing';
    this.#tick = 0;
    this.#cursor = 0;
  }
}
