import { expect, it } from 'vitest';
import { DeploymentEditor } from '../../src/ui/deployment';

it('cannot assign more veterans than available and refuses to build invalid data', () => {
  const editor = new DeploymentEditor({ infantry: { veteran: 10 } });
  editor.assign('front', 'infantry', 'veteran', 11);
  expect(editor.canStartBattle).toBe(false);
  expect(editor.validationMessage).toContain('10 veteran infantry available');
  expect(() => editor.buildDeployment()).toThrow(
    /10 veteran infantry available/,
  );
});

it('reserves exact type/tier inventory across slots and replaces an old assignment', () => {
  const editor = new DeploymentEditor({
    infantry: { veteran: 10 },
    archer: { recruit: 4 },
  });
  editor.assign('front', 'infantry', 'veteran', 6);
  editor.assign('rear', 'infantry', 'veteran', 5);
  expect(editor.canStartBattle).toBe(false);
  editor.assign('front', 'archer', 'recruit', 4);
  expect(editor.canStartBattle).toBe(true);
  expect(editor.remaining('infantry', 'veteran')).toBe(5);
  expect(editor.remaining('archer', 'recruit')).toBe(0);
  expect(editor.buildDeployment().groups).toHaveLength(2);
  editor.assign('rear', 'infantry', 'veteran', 0);
  expect(editor.remaining('infantry', 'veteran')).toBe(10);
  expect(editor.buildDeployment().groups).toHaveLength(1);
});

it('uses largest fractional remainder with recruit-first tie breaks, retaining exact totals', () => {
  const editor = new DeploymentEditor({
    infantry: { recruit: 10, trained: 10, veteran: 10, elite: 10 },
  });
  editor.setRatios('front', 'infantry', 7, [25, 25, 25, 25]);
  expect(
    editor.buildDeployment().groups[0].cohorts.map((c) => c.count),
  ).toEqual([2, 2, 2, 1]);
  editor.setRatios('front', 'infantry', 7, [10, 20, 30, 40]);
  expect(
    editor.buildDeployment().groups[0].cohorts.map((c) => c.count),
  ).toEqual([1, 1, 2, 3]);
});

it('does not silently substitute another experience tier when a ratio exceeds inventory', () => {
  const editor = new DeploymentEditor({
    infantry: { recruit: 100, veteran: 1 },
  });
  editor.setRatios('front', 'infantry', 5, [50, 0, 50, 0]);
  expect(editor.canStartBattle).toBe(false);
  expect(editor.validationMessage).toContain('1 veteran infantry available');
});

it('keeps integer remainder ranking exact at the safe-integer boundary', () => {
  const editor = new DeploymentEditor({
    infantry: {
      recruit: Number.MAX_SAFE_INTEGER,
      trained: Number.MAX_SAFE_INTEGER,
    },
  });
  editor.setRatios('front', 'infantry', Number.MAX_SAFE_INTEGER, [6, 94, 0, 0]);
  expect(
    editor.buildDeployment().groups[0].cohorts.map((c) => c.count),
  ).toEqual([540431955284459, 8466767299456532]);
});

it.each([-1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])(
  'rejects unsafe quantity %s with one actionable message',
  (count) => {
    const editor = new DeploymentEditor({ infantry: { recruit: 10 } });
    editor.assign('front', 'infantry', 'recruit', count);
    expect(editor.canStartBattle).toBe(false);
    expect(editor.validationMessage).toMatch(
      /Front.*quantity.*nonnegative.*integer/i,
    );
  },
);

it.each([
  [-1, 1, 0, 0],
  [NaN, 0, 0, 0],
  [Infinity, 0, 0, 0],
  [0, 0, 0, 0],
  [20, 20, 20, 20],
  [1.5, 98.5, 0, 0],
])('rejects invalid percentages %s', (...ratios) => {
  const editor = new DeploymentEditor({ infantry: { recruit: 10 } });
  editor.setRatios('front', 'infantry', 5, ratios);
  expect(editor.canStartBattle).toBe(false);
  expect(editor.validationMessage).toMatch(/Front.*percentages.*whole.*100/i);
});

it('rejects an empty deployment, unknown fields, and corrupt inventory', () => {
  const editor = new DeploymentEditor({});
  expect(editor.validationMessage).toMatch(/at least one unit/i);
  expect(() =>
    editor.assign('unknown' as never, 'infantry', 'recruit', 1),
  ).toThrow(/slot/i);
  expect(() =>
    editor.assign('front', 'unknown' as never, 'recruit', 1),
  ).toThrow(/type/i);
  expect(() =>
    editor.assign('front', 'infantry', 'unknown' as never, 1),
  ).toThrow(/tier/i);
  expect(() => new DeploymentEditor({ infantry: { recruit: -1 } })).toThrow(
    /inventory/i,
  );
});

it('clones external inventory and returns deeply immutable detached deployments', () => {
  const inventory = { infantry: { recruit: 10 } };
  const editor = new DeploymentEditor(inventory);
  inventory.infantry.recruit = 0;
  editor.assign('front', 'infantry', 'recruit', 4);
  const first = editor.buildDeployment();
  editor.assign('front', 'infantry', 'recruit', 6);
  expect(first.groups[0].cohorts[0].count).toBe(4);
  expect(
    [
      first,
      first.groups,
      first.groups[0],
      first.groups[0].cohorts,
      first.groups[0].cohorts[0],
    ].every(Object.isFrozen),
  ).toBe(true);
  editor.lock();
  expect(() => editor.assign('rear', 'infantry', 'recruit', 1)).toThrow(
    /locked/i,
  );
  expect(() => editor.setRatios('rear', 'infantry', 1, [100, 0, 0, 0])).toThrow(
    /locked/i,
  );
});
