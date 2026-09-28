import { describe, expect, it } from 'vitest';
import { BattlePlayback } from '../../src/game/BattlePlayback';
import { BattleEventLogBuilder } from '../../src/domain/battleEventLog';
import type {
  BattleEvent,
  BattleEventLog,
  BattleResult,
  BattleUnitSnapshot,
} from '../../src/domain/battleEvents';
import { singleCohortArmy } from '../fixtures';
import { UnitViewPool } from '../../src/game/UnitViewPool';

function fixture(): BattleResult {
  const unit = (id: number, side: 'left' | 'right'): BattleUnitSnapshot => ({
    id,
    side,
    type: 'archer',
    tier: 'recruit',
    slot: 'rear',
    hitPoints: 70,
    position: side === 'left' ? -1 : 1,
    targetId: null,
    nextAttackTick: 0,
    survivedVictories: 0,
  });
  const log = new BattleEventLogBuilder();
  log.push({ type: 'gate-opened', side: 'left', tick: 0 });
  log.push({ type: 'march-started', side: 'left', tick: 0 });
  log.push({
    type: 'charge-started',
    side: 'left',
    unitId: 1,
    targetId: 2,
    position: -0.14,
    distance: 0.28,
    tick: 10,
  });
  log.push({
    type: 'attack',
    attackerId: 1,
    targetId: 2,
    attackerPosition: -0.12,
    targetPosition: 0.12,
    damage: 70,
    randomFactor: 1,
    tick: 12,
  });
  log.push({
    type: 'death',
    side: 'right',
    unitId: 2,
    position: 0.12,
    tick: 12,
  });
  log.push({
    type: 'battle-ended',
    outcome: 'victory',
    winner: 'left',
    tick: 13,
  });
  return {
    outcome: 'victory',
    winner: 'left',
    seed: 1,
    initialUnits: [unit(1, 'left'), unit(2, 'right')],
    durationTicks: 13,
    events: log.finish(),
    leftSurvivors: singleCohortArmy('left', 'archer', 'recruit', 1),
    rightSurvivors: singleCohortArmy('right', 'archer', 'recruit', 0),
  };
}

describe('BattlePlayback', () => {
  it('continues charging beyond the charge anchor before the first attack', () => {
    const base = fixture();
    const log = new BattleEventLogBuilder();
    log.push({ type: 'march-started', side: 'left', tick: 0 });
    log.push({
      type: 'charge-started',
      side: 'left',
      tick: 0,
      unitId: 1,
      targetId: 2,
      position: -0.9,
      distance: 0.28,
    });
    const playback = new BattlePlayback();
    playback.load({ ...base, events: log.finish() });
    playback.advance(800, 1);
    for (let i = 0; i < 100; i++) playback.advance(50, 1);
    expect(playback.units[0].position).toBeCloseTo(-0.7404);
  });

  it('keeps the aggregated view until its last member dies without remapping survivors', () => {
    const base = fixture();
    const initialUnits = Array.from({ length: 2000 }, (_, i) => ({
      ...base.initialUnits[0],
      id: i + 1,
    }));
    const log = new BattleEventLogBuilder();
    for (let i = 1; i <= 5; i++)
      log.push({
        type: 'death',
        side: 'left',
        unitId: i,
        position: 0,
        tick: i,
      });
    const playback = new BattlePlayback();
    playback.load({ ...base, initialUnits, events: log.finish() });
    const first = playback.units[0];
    expect(first.unitIds).toEqual([1, 2, 3, 4, 5]);
    playback.advance(1850, 1);
    expect(first.aliveCount).toBe(4);
    expect(first.dying).toBe(false);
    expect(playback.counts.left).toBe(1999);
    playback.advance(200, 1);
    expect(first.dying).toBe(true);
    expect(playback.units[1].unitIds).toEqual([6, 7, 8, 9, 10]);
    expect(playback.counts.left).toBe(1995);
  });

  it('replays three injected 2000-v-2000 million-event results with bounded reads and warmed views', () => {
    const base = fixture();
    const initialUnits = Array.from({ length: 4000 }, (_, i) => ({
      ...base.initialUnits[i < 2000 ? 0 : 1],
      id: i + 1,
    }));
    const playback = new BattlePlayback();
    const pool = new UnitViewPool(
      800,
      () => ({}),
      () => {},
    );
    const arrows = [...playback.arrows];
    let totalReads = 0;
    let frameReads = 0;
    let maxFrameReads = 0;
    const events: BattleEventLog = {
      length: 1_004_001,
      byteLength: 0,
      findTick(tick) {
        return tick > 0 ? this.length : 0;
      },
      at(index): BattleEvent {
        frameReads++;
        totalReads++;
        if (index < 1_000_000)
          return {
            type: 'attack',
            tick: 0,
            attackerId: index % 2 ? 1 : 2001,
            targetId: index % 2 ? 2001 : 1,
            damage: 1,
            randomFactor: 1,
            attackerPosition: 0,
            targetPosition: 0,
          };
        if (index < 1_004_000)
          return {
            type: 'death',
            tick: 0,
            unitId: index - 1_000_000 + 1,
            side: index < 1_002_000 ? 'left' : 'right',
            position: 0,
          };
        return { type: 'battle-ended', tick: 0, outcome: 'draw', winner: null };
      },
      [Symbol.iterator](): Iterator<BattleEvent> {
        throw new Error('Must never iterate or materialize');
      },
    };
    for (let run = 0; run < 3; run++) {
      playback.load({ ...base, initialUnits, events });
      expect(playback.units).toHaveLength(800);
      playback.units.forEach((unit) => pool.acquire(unit.id));
      while (playback.phase !== 'result') {
        frameReads = 0;
        playback.advance(800, 1);
        maxFrameReads = Math.max(maxFrameReads, frameReads);
      }
      expect(playback.counts).toEqual({ left: 0, right: 0 });
      expect(playback.eventCount).toBe(0);
      expect(playback.units.every((unit) => unit.dying)).toBe(true);
      playback.clear();
      pool.releaseAll();
      expect(pool.totalCreated).toBe(800);
      expect(pool.activeCount).toBe(0);
      expect(
        playback.arrows.every((arrow, index) => arrow === arrows[index]),
      ).toBe(true);
    }
    expect(totalReads).toBe(3_012_003);
    expect(maxFrameReads).toBeLessThanOrEqual(4096);
  });

  it('presents gates, march, charge, ranged attack, death and returning survivors', () => {
    const playback = new BattlePlayback();
    playback.load(fixture());
    expect(playback.phase).toBe('gates');
    playback.advance(1800, 1);
    expect(playback.phase).toBe('marching');
    playback.advance(500, 1);
    expect(playback.phase).toBe('charging');
    expect(playback.units[0].charged).toBe(true);
    playback.advance(100, 1);
    expect(playback.phase).toBe('fighting');
    expect(playback.arrows.some((a) => a.active)).toBe(true);
    expect(playback.units[1].dying).toBe(true);
    expect(playback.counts).toEqual({ left: 1, right: 0 });
    playback.advance(50, 1);
    expect(playback.phase).toBe('result');
    expect(playback.eventCount).toBe(0);
    playback.advance(1100, 1);
    expect(playback.phase).toBe('returning');
    expect(playback.units[1].visible).toBe(false);
    playback.advance(3100, 1);
    expect(playback.phase).toBe('preparing');
    expect(playback.units).toHaveLength(0);
    expect(playback.eventCount).toBe(0);
  });

  it('pauses all animations and replaces old replay state', () => {
    const playback = new BattlePlayback();
    playback.load(fixture());
    playback.advance(10000, 0);
    expect(playback.phase).toBe('gates');
    expect(playback.time).toBe(0);
    playback.advance(2450, 1);
    expect(playback.counts.right).toBe(0);
    playback.load(fixture());
    expect(playback.counts.right).toBe(1);
    expect(playback.arrows.every((a) => !a.active)).toBe(true);
    expect(playback.time).toBe(0);
    playback.clear();
    expect(playback.units).toHaveLength(0);
  });
});
