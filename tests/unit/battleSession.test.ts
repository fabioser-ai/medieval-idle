import { describe, expect, it } from 'vitest';
import { BattleSession } from '../../src/application/battleSession';
import { singleCohortArmy } from '../fixtures';
import { simulateBattle } from '../../src/domain/battleSimulation';
import { BattleEventLogBuilder } from '../../src/domain/battleEventLog';
import type { BattleResult } from '../../src/domain/battleEvents';

describe('battle session', () => {
  it('guards invalid clock/speed inputs and illegal lifecycle transitions', () => {
    const session = new BattleSession();
    for (const milliseconds of [-1, NaN, Infinity])
      expect(() => session.advance(milliseconds)).toThrow(RangeError);
    expect(() => session.setPlaybackSpeed(3 as 1)).toThrow(RangeError);
    expect(() => session.beginReturn()).toThrow();
    expect(() => session.finishReturn()).toThrow();
    session.advance(500);
    expect(session.phase).toBe('preparing');
  });
  it('produces identical events and survivors independently of playback speed', () => {
    const left = singleCohortArmy('left', 'infantry', 'elite', 3);
    const right = singleCohortArmy('right', 'infantry', 'recruit', 1);
    const normal = new BattleSession();
    const fast = new BattleSession();
    const a = normal.start(left, right, 8);
    const b = fast.start(left, right, 8);
    fast.setPlaybackSpeed(4);
    normal.advance(1_000_000);
    fast.advance(1_000_000);
    expect(a.leftSurvivors).toEqual(b.leftSurvivors);
    expect(a.rightSurvivors).toEqual(b.rightSurvivors);
    expect(a.winner).toBe(b.winner);
    expect(a.events.length).toBe(b.events.length);
    for (let i = 0; i < a.events.length; i++)
      expect(a.events.at(i)).toEqual(b.events.at(i));
  });
  it('simulates exactly once per start, releases old results before restart, and never iterates the event log', () => {
    const left = singleCohortArmy('left', 'infantry', 'elite', 3);
    const right = singleCohortArmy('right', 'infantry', 'recruit', 1);
    let simulations = 0;
    const session = new BattleSession((a, b, seed) => {
      simulations += 1;
      expect(session.result).toBeNull();
      const result = simulateBattle(a, b, seed);
      return {
        ...result,
        events: {
          ...result.events,
          [Symbol.iterator]() {
            throw new Error('Do not materialize');
          },
        },
      };
    });
    const first = session.start(left, right, 1);
    session.advance(2000);
    session.setPlaybackSpeed(4);
    session.advance(1_000_000);
    expect(simulations).toBe(1);
    expect(session.result).toBe(first);
    const second = session.start(left, right, 2);
    expect(session.result).toBe(second);
    expect(second === first).toBe(false);
    expect(simulations).toBe(2);
    expect(session.eventCursor).toBe(0);
    expect(session.playbackTick).toBe(0);
    expect(() => session.start(left, right, NaN)).toThrow();
    expect(session.result).toBeNull();
    expect(session.phase).toBe('preparing');
  });
  it('uses event ticks, never regresses from fighting on late charges, and reaches result exactly on its event', () => {
    const left = singleCohortArmy('left', 'infantry', 'elite', 3);
    const right = singleCohortArmy('right', 'infantry', 'recruit', 1);
    const log = new BattleEventLogBuilder();
    log.push({ type: 'gate-opened', side: 'left', tick: 0 });
    log.push({ type: 'march-started', side: 'left', tick: 1 });
    log.push({
      type: 'charge-started',
      side: 'left',
      tick: 2,
      unitId: 1,
      targetId: 2,
      position: 0,
      distance: 0.2,
    });
    log.push({
      type: 'attack',
      tick: 3,
      attackerId: 1,
      targetId: 2,
      damage: 1,
      randomFactor: 1,
      attackerPosition: 0,
      targetPosition: 0,
    });
    log.push({
      type: 'charge-started',
      side: 'left',
      tick: 4,
      unitId: 1,
      targetId: 2,
      position: 0,
      distance: 0.2,
    });
    log.push({
      type: 'battle-ended',
      tick: 5,
      winner: 'left',
      outcome: 'victory',
    });
    const fixture: BattleResult = {
      outcome: 'victory',
      winner: 'left',
      leftSurvivors: left,
      rightSurvivors: { ...right, groups: [] },
      durationTicks: 5,
      seed: 1,
      initialUnits: [],
      events: log.finish(),
    };
    const session = new BattleSession(() => fixture);
    session.start(left, right, 1);
    session.advance(0);
    expect(session.phase).toBe('gates');
    session.advance(50);
    expect(session.phase).toBe('marching');
    session.advance(50);
    expect(session.phase).toBe('charging');
    session.advance(50);
    expect(session.phase).toBe('fighting');
    session.advance(50);
    expect(session.phase).toBe('fighting');
    session.advance(49);
    expect(session.phase).toBe('fighting');
    session.advance(1);
    expect(session.phase).toBe('result');
  });
  it('starts once and keeps its result unchanged through pauses and playback speed changes', () => {
    const session = new BattleSession();
    const left = singleCohortArmy('left', 'infantry', 'elite', 3);
    const right = singleCohortArmy('right', 'infantry', 'recruit', 1);
    expect(session.phase).toBe('preparing');
    const result = session.start(left, right, 12);
    expect(session.phase).toBe('gates');
    session.setPlaybackSpeed(0);
    session.advance(1000);
    expect(session.playbackTick).toBe(0);
    session.setPlaybackSpeed(2);
    session.advance(50);
    expect(session.playbackTick).toBe(2);
    expect(session.phase).toBe('marching');
    session.setPlaybackSpeed(4);
    session.advance(1_000_000);
    expect(session.phase).toBe('result');
    expect(session.playbackTick).toBe(result.durationTicks);
    expect(session.result).toBe(result);
    session.beginReturn();
    expect(session.phase).toBe('returning');
    session.finishReturn();
    expect(session.phase).toBe('preparing');
    expect(session.result).toBeNull();
  });
});
