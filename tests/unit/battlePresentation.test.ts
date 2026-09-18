import { describe, expect, it } from 'vitest';
import type {
  BattleEvent,
  BattleEventLog,
  BattleUnitSnapshot,
} from '../../src/domain/battleEvents';
import {
  aggregateUnits,
  battlefieldPoint,
  densityLabel,
  EventCursor,
  unitFrame,
} from '../../src/game/battlePresentation';
import { UnitViewPool } from '../../src/game/UnitViewPool';

function units(
  count: number,
  side: 'left' | 'right',
  offset = 0,
): BattleUnitSnapshot[] {
  return Array.from({ length: count }, (_, i) => ({
    id: offset + i + 1,
    side,
    type: i < count * 0.75 ? 'infantry' : 'archer',
    tier: 'recruit',
    slot: 'front',
    hitPoints: 100,
    position: side === 'left' ? -1 : 1,
    targetId: null,
    nextAttackTick: 0,
    survivedVictories: 0,
  }));
}

function compactSource(length: number): BattleEventLog {
  return {
    length,
    byteLength: 0,
    at(index): BattleEvent | undefined {
      return index < length
        ? { type: 'gate-opened', side: 'left', tick: Math.floor(index / 4000) }
        : undefined;
    },
    findTick(tick) {
      return Math.min(length, Math.ceil(tick) * 4000);
    },
    [Symbol.iterator](): Iterator<BattleEvent> {
      throw new Error('Never materialize the event log');
    },
  };
}

describe('battle presentation', () => {
  it('preserves one view per unit below the cap and exact density counts', () => {
    const groups = aggregateUnits(units(12, 'left'));
    expect(groups.views).toHaveLength(12);
    expect(groups.views.every((v) => v.unitIds.length === 1)).toBe(true);
    expect(densityLabel(12, 12)).toBe('12 troops');
    expect(densityLabel(2000, 400)).toBe('2,000 troops · 400 shown');
  });

  it('caps each side independently with proportional, deterministic stable mappings', () => {
    const input = [...units(2000, 'left'), ...units(2000, 'right', 2000)];
    const result = aggregateUnits(input);
    expect(result.views).toHaveLength(800);
    for (const side of ['left', 'right']) {
      const views = result.views.filter((v) => v.unit.side === side);
      expect(views).toHaveLength(400);
      expect(views.filter((v) => v.unit.type === 'infantry')).toHaveLength(300);
      expect(views.filter((v) => v.unit.type === 'archer')).toHaveLength(100);
      expect(views.reduce((sum, v) => sum + v.unitIds.length, 0)).toBe(2000);
    }
    expect(result.byUnitId.size).toBe(4000);
    expect([...result.byUnitId]).toEqual([...aggregateUnits(input).byUnitId]);
    const stable = result.byUnitId.get(17);
    result.views[0].aliveCount -= 1;
    expect(result.byUnitId.get(17)).toBe(stable);
  });

  it('keeps rare silhouettes and distributes uneven cohorts within one view of quota', () => {
    const input = units(2000, 'left').map((u, i) => ({
      ...u,
      type: i === 0 ? ('cavalry' as const) : u.type,
    }));
    const { views } = aggregateUnits(input);
    expect(views).toHaveLength(400);
    expect(views.filter((v) => v.unit.type === 'cavalry')).toHaveLength(1);
    expect(views.filter((v) => v.unit.type === 'infantry')).toHaveLength(299);
    expect(new Set(views.flatMap((v) => v.unitIds)).size).toBe(2000);
  });

  it('streams only the due prefix with a hard per-call decoding budget and releases sources', () => {
    const cursor = new EventCursor(3);
    cursor.attach(compactSource(20000));
    let consumed = 0;
    expect(
      cursor.drain(0, () => {
        consumed++;
      }),
    ).toBe(3);
    expect(consumed).toBe(3);
    expect(cursor.index).toBe(3);
    expect(cursor.pending).toBe(true);
    cursor.attach(compactSource(4));
    expect(cursor.index).toBe(0);
    cursor.drain(1, () => {
      consumed++;
    });
    cursor.drain(1, () => {
      consumed++;
    });
    expect(cursor.index).toBe(4);
    expect(cursor.pending).toBe(false);
    cursor.clear();
    expect(cursor.length).toBe(0);
    expect(
      cursor.drain(100, () => {
        throw new Error('released');
      }),
    ).toBe(0);
  });

  it('maps gates, valley and formation lanes into crisp logical pixels', () => {
    expect(battlefieldPoint(-1, 'front', 0)).toEqual({ x: 60, y: 153 });
    expect(battlefieldPoint(1, 'front', 0)).toEqual({ x: 420, y: 153 });
    expect(battlefieldPoint(0, 'front', 0)).toEqual({ x: 240, y: 209 });
    expect(battlefieldPoint(-8, 'front', 0).x).toBe(60);
    expect(battlefieldPoint(0, 'rear', 1).y).not.toBe(209);
    expect(unitFrame(0, 0)).toBe(0);
    expect(unitFrame(160, 0)).toBe(1);
    expect(unitFrame(320, 0)).toBe(0);
  });

  it('repeats 2000-versus-2000 compact-source playback without new views or event retention', () => {
    const pool = new UnitViewPool(
      800,
      () => ({}),
      () => {},
    );
    const cursor = new EventCursor(4096);
    const input = [...units(2000, 'left'), ...units(2000, 'right', 2000)];
    let count = 0;
    for (let run = 0; run < 3; run++) {
      const { views } = aggregateUnits(input);
      views.forEach((v) => pool.acquire(v.id));
      cursor.attach(compactSource(1_000_000));
      while (cursor.index < cursor.length)
        cursor.drain(1000, () => {
          count++;
        });
      cursor.clear();
      pool.releaseAll();
      expect(pool.totalCreated).toBe(800);
      expect(pool.activeCount).toBe(0);
      expect(cursor.length).toBe(0);
    }
    expect(count).toBe(3_000_000);
  });
});
