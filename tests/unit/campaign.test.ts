import { expect, it } from 'vitest';
import { Campaign } from '../../src/application/campaign';
import { SaveStore } from '../../src/application/saveStore';
import { formationDuel } from '../../src/game/acceptanceScenarios';
import { simulateBattle } from '../../src/domain/battleSimulation';
const memory = () => {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => {
      map.set(key, value);
    },
  };
};
it('commits survivors once at terminal, preserves reserves, and reloads exact progression', () => {
  const storage = memory(),
    store = new SaveStore(storage),
    c = new Campaign(store);
  const preset = formationDuel('rear');
  c.reset(preset.left);
  const deployed = c.deploy({
    ...preset.left,
    groups: [
      {
        slot: 'rear',
        cohorts: [{ type: 'archer', tier: 'trained', count: 4 }],
      },
    ],
  });
  const result = simulateBattle(
    deployed,
    {
      ...preset.right,
      groups: [
        {
          slot: 'front',
          cohorts: [{ type: 'infantry', tier: 'recruit', count: 1 }],
        },
      ],
    },
    626,
  );
  c.stage(result, deployed);
  expect(new Campaign(store).data.availableCohorts[0].count).toBe(5);
  c.finish();
  const saved = JSON.stringify(c.data);
  c.finish();
  expect(JSON.stringify(c.data)).toBe(saved);
  expect(c.data.availableCohorts).toEqual([
    { type: 'archer', tier: 'trained', count: 1, survivedVictories: 0 },
    { type: 'archer', tier: 'trained', count: 4, survivedVictories: 1 },
  ]);
  expect(new Campaign(store).data).toEqual(c.data);
  const next = c.deploy({
    ...preset.left,
    groups: [
      {
        slot: 'rear',
        cohorts: [{ type: 'archer', tier: 'trained', count: 3 }],
      },
    ],
  });
  expect(next.groups[0].cohorts).toEqual([
    { type: 'archer', tier: 'trained', count: 1, survivedVictories: 0 },
    { type: 'archer', tier: 'trained', count: 2, survivedVictories: 1 },
  ]);
});
it('recovers the last valid backup on reload and reports corrupt/unavailable storage', () => {
  const storage = memory(),
    store = new SaveStore(storage),
    c = new Campaign(store);
  c.reset(formationDuel('rear').left);
  c.reset(formationDuel('front').left);
  storage.setItem('medieval-idle.save', '{broken');
  const restored = new Campaign(store);
  expect(restored.notice).toMatch(/backup/i);
  expect(restored.inventory.archer?.trained).toBe(5);
  storage.setItem('medieval-idle.save.backup', 'bad');
  expect(new Campaign(store).notice).toMatch(/could not/i);
  const blocked = new Campaign(
    new SaveStore({
      getItem: () => null,
      setItem: () => {
        throw Error('blocked');
      },
    }),
  );
  blocked.reset(formationDuel('rear').left);
  expect(blocked.notice).toMatch(/could not save/i);
});
it('rejects overdraw and more than 240 troops before simulation', () => {
  const c = new Campaign(new SaveStore(memory()));
  expect(() => c.deploy(formationDuel('rear').left)).not.toThrow();
  const tooMany = {
    ...formationDuel('rear').left,
    groups: [
      {
        slot: 'rear' as const,
        cohorts: [
          { type: 'archer' as const, tier: 'trained' as const, count: 241 },
        ],
      },
    ],
  };
  expect(() => c.deploy(tooMany)).toThrow(/240/);
  expect(() =>
    c.deploy({
      ...tooMany,
      groups: [
        {
          ...tooMany.groups[0],
          cohorts: [{ ...tooMany.groups[0].cohorts[0], count: 11 }],
        },
      ],
    }),
  ).toThrow(/inventory/i);
});
