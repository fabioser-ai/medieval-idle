import { describe, expect, it } from 'vitest';
import { SaveStore, type SaveData } from '../../src/application/saveStore';

class MemoryStorage {
  values = new Map<string, string>();
  getItem(key: string) {
    return this.values.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}
const firstSave = (): SaveData => ({
  schemaVersion: 1,
  kingdom: 'Blue',
  availableCohorts: [
    { type: 'infantry', tier: 'trained', count: 2, survivedVictories: 1 },
  ],
  reservedTrainerCohorts: [],
  lastSeed: 7,
  lastResult: {
    outcome: 'victory',
    winner: 'left',
    durationTicks: 10,
    leftSurvivors: 2,
    rightSurvivors: 0,
  },
});

describe('save store', () => {
  it.each([
    null,
    [],
    {},
    { schemaVersion: 2 },
    { kingdom: ' ' },
    { availableCohorts: null },
    { availableCohorts: [null] },
    ...[
      { type: 'wizard' },
      { tier: 'super' },
      { count: -1 },
      { count: 0.5 },
      { count: Number.MAX_SAFE_INTEGER + 1 },
      { survivedVictories: undefined },
      { survivedVictories: -1 },
      { survivedVictories: 1.5 },
      { survivedVictories: Infinity },
    ].map((change) => ({
      availableCohorts: [
        {
          type: 'infantry',
          tier: 'recruit',
          count: 1,
          survivedVictories: 0,
          ...change,
        },
      ],
    })),
    { reservedTrainerCohorts: [{}] },
    { reservedTrainerCohorts: undefined },
    { lastSeed: 1.5 },
    { lastSeed: '2' },
    { lastSeed: undefined },
    { lastResult: {} },
    {
      lastResult: {
        outcome: 'victory',
        winner: null,
        durationTicks: 1,
        leftSurvivors: 0,
        rightSurvivors: 0,
      },
    },
    {
      lastResult: {
        outcome: 'draw',
        winner: null,
        durationTicks: 1,
        leftSurvivors: 1,
        rightSurvivors: 1,
      },
    },
    {
      lastResult: {
        outcome: 'victory',
        winner: 'left',
        durationTicks: -1,
        leftSurvivors: 1,
        rightSurvivors: 0,
      },
    },
  ])(
    'rejects malformed or unsupported saved data %# without overwriting valid storage',
    (patch) => {
      const storage = new MemoryStorage();
      const store = new SaveStore(storage);
      store.save(firstSave());
      const bad =
        patch === null ||
        Array.isArray(patch) ||
        Object.keys(patch).length === 0
          ? patch
          : { ...firstSave(), ...patch };
      expect(store.save(bad as SaveData)).toEqual({ status: 'invalid' });
      expect(store.load()).toEqual({ status: 'loaded', data: firstSave() });
      storage.setItem('medieval-idle.save', JSON.stringify(bad));
      expect(store.load()).toEqual({ status: 'corrupt' });
    },
  );
  it('accepts an empty kingdom roster, null history and right/draw summaries', () => {
    const store = new SaveStore(new MemoryStorage());
    const empty: SaveData = {
      ...firstSave(),
      availableCohorts: [],
      lastSeed: null,
      lastResult: null,
    };
    expect(store.save(empty)).toEqual({ status: 'saved' });
    expect(store.load()).toEqual({ status: 'loaded', data: empty });
    expect(
      store.save({
        ...empty,
        lastResult: {
          outcome: 'draw',
          winner: null,
          durationTicks: 2,
          leftSurvivors: 0,
          rightSurvivors: 0,
        },
      }),
    ).toEqual({ status: 'saved' });
    expect(
      store.save({
        ...empty,
        lastResult: {
          outcome: 'victory',
          winner: 'right',
          durationTicks: 2,
          leftSurvivors: 0,
          rightSurvivors: 1,
        },
      }),
    ).toEqual({ status: 'saved' });
  });
  it('preserves a valid backup when saving over a corrupt primary', () => {
    const storage = new MemoryStorage();
    const store = new SaveStore(storage);
    store.save(firstSave());
    store.save({ ...firstSave(), lastSeed: 8 });
    storage.setItem('medieval-idle.save', '{broken');
    expect(store.save({ ...firstSave(), lastSeed: 9 })).toEqual({
      status: 'saved',
    });
    storage.setItem('medieval-idle.save', '{broken again');
    expect(store.load()).toEqual({
      status: 'corrupt-recovered',
      data: firstSave(),
    });
  });
  it('recovers a backup with missing primary, and reports corrupt when neither copy is valid', () => {
    const storage = new MemoryStorage();
    storage.setItem('medieval-idle.save.backup', JSON.stringify(firstSave()));
    const store = new SaveStore(storage);
    expect(store.load()).toEqual({
      status: 'corrupt-recovered',
      data: firstSave(),
    });
    storage.setItem('medieval-idle.save.backup', 'null');
    expect(store.load()).toEqual({ status: 'corrupt' });
  });
  it.each(['medieval-idle.save', 'medieval-idle.save.backup'])(
    'contains quota failures writing %s without destroying the last valid primary',
    (failingKey) => {
      const memory = new MemoryStorage();
      new SaveStore(memory).save(firstSave());
      const store = new SaveStore({
        getItem: (key) => memory.getItem(key),
        setItem(key, value) {
          if (key === failingKey) throw new Error('quota');
          memory.setItem(key, value);
        },
      });
      expect(store.save({ ...firstSave(), lastSeed: 10 })).toEqual({
        status: 'storage-error',
      });
      expect(store.load()).toEqual({ status: 'loaded', data: firstSave() });
    },
  );
  it('contains unavailable storage and cyclic input errors', () => {
    const broken = new SaveStore({
      getItem() {
        throw new Error('blocked');
      },
      setItem() {
        throw new Error('blocked');
      },
    });
    expect(broken.load()).toEqual({ status: 'corrupt' });
    expect(broken.save(firstSave())).toEqual({ status: 'storage-error' });
    const cyclic = { ...firstSave(), extra: {} };
    cyclic.extra = cyclic;
    expect(new SaveStore(new MemoryStorage()).save(cyclic)).toEqual({
      status: 'storage-error',
    });
  });
  it('still recovers a readable backup when reading primary storage throws', () => {
    const store = new SaveStore({
      getItem(key) {
        if (key === 'medieval-idle.save') throw new Error('blocked');
        return JSON.stringify(firstSave());
      },
      setItem() {},
    });
    expect(store.load()).toEqual({
      status: 'corrupt-recovered',
      data: firstSave(),
    });
  });
  it('loads empty storage and round trips the schema without references', () => {
    const store = new SaveStore(new MemoryStorage());
    expect(store.load()).toEqual({ status: 'empty' });
    expect(store.save(firstSave())).toEqual({ status: 'saved' });
    expect(store.load()).toEqual({ status: 'loaded', data: firstSave() });
  });
  it('recovers the last valid backup after corrupt primary JSON', () => {
    const storage = new MemoryStorage();
    const store = new SaveStore(storage);
    store.save(firstSave());
    store.save({ ...firstSave(), lastSeed: 8 });
    storage.setItem('medieval-idle.save', '{broken');
    expect(store.load()).toEqual({
      status: 'corrupt-recovered',
      data: firstSave(),
    });
  });
});
