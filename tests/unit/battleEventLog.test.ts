import { expect, it } from 'vitest';
import type { BattleEvent } from '../../src/domain/battleEvents';
import { BattleEventLogBuilder } from '../../src/domain/battleEventLog';

const events: BattleEvent[] = [
  { type: 'gate-opened', side: 'left', tick: 0 },
  { type: 'gate-opened', side: 'right', tick: 0 },
  { type: 'march-started', side: 'left', tick: 0 },
  { type: 'march-started', side: 'right', tick: 0 },
  {
    type: 'charge-started',
    tick: 10,
    unitId: 1,
    targetId: 2,
    side: 'left',
    position: -0.13,
    distance: 0.26,
  },
  {
    type: 'charge-started',
    tick: 10,
    unitId: 2,
    targetId: 1,
    side: 'right',
    position: 0.13,
    distance: 0.26,
  },
  {
    type: 'attack',
    tick: 20,
    attackerId: 1,
    targetId: 2,
    damage: 2,
    randomFactor: 0.975,
    attackerPosition: -0.024,
    targetPosition: 0.024,
  },
  { type: 'death', tick: 20, unitId: 2, side: 'right', position: 0.024 },
  { type: 'death', tick: 20, unitId: 1, side: 'left', position: -0.024 },
  { type: 'battle-ended', tick: 20, outcome: 'draw', winner: null },
];

it('losslessly streams and seeks frozen events from compact storage', () => {
  const builder = new BattleEventLogBuilder();
  events.forEach((event) => builder.push(event));
  const log = builder.finish();
  expect([...log]).toEqual(events);
  expect(log.length).toBe(10);
  expect(log.at(-1)).toEqual(events[9]);
  expect(log.at(10)).toBeUndefined();
  expect(log.at(-11)).toBeUndefined();
  expect(log.findTick(10)).toBe(4);
  expect(log.findTick(11)).toBe(6);
  expect(log.findTick(21)).toBe(10);
  expect(Object.isFrozen(log)).toBe(true);
  for (const event of log) expect(Object.isFrozen(event)).toBe(true);
  expect(() => builder.push(events[0])).toThrow();
  expect([...log]).toEqual(events);
});

it('packs columns and tick runs within a linear storage budget without materializing events', () => {
  const builder = new BattleEventLogBuilder();
  for (let index = 0; index < 100_000; index += 1)
    builder.push({ ...events[6], tick: index });
  const log = builder.finish();
  expect(log.length).toBe(100_000);
  // 25-byte event slots + 8-byte tick runs + three exact dictionary values.
  expect(log.byteLength).toBeLessThanOrEqual(100_000 * 33 + 4096 * 25 + 24);
  for (const index of [0, 4095, 4096, 8191, 50_000, 99_999]) {
    expect(log.at(index)).toEqual({ ...events[6], tick: index });
    expect(log.findTick(index)).toBe(index);
  }
});

it('preserves all Float64 numeric values including signed zero under lossless packing', () => {
  const builder = new BattleEventLogBuilder();
  const event: BattleEvent = {
    type: 'attack',
    tick: 100_000,
    attackerId: 4000,
    targetId: 3999,
    damage: Number.MAX_SAFE_INTEGER,
    randomFactor: 0.975123456789,
    attackerPosition: -0,
    targetPosition: Number.MIN_VALUE,
  };
  builder.push(event);
  builder.push({ ...event, attackerPosition: 0, targetPosition: -0 });
  expect([...builder.finish()]).toEqual([
    event,
    { ...event, attackerPosition: 0, targetPosition: -0 },
  ]);
});

it.each(['left', 'right'] as const)(
  'preserves %s victory events exactly',
  (winner) => {
    const builder = new BattleEventLogBuilder();
    const event: BattleEvent = {
      type: 'battle-ended',
      tick: 120,
      outcome: 'victory',
      winner,
    };
    builder.push(event);
    expect(builder.finish().at(0)).toEqual(event);
  },
);
