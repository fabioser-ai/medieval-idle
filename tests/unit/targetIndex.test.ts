import { expect, it } from 'vitest';
import { createTargetIndex } from '../../src/domain/targetIndex';

it('indexes positions and selects the nearest target with lowest-ID ties', () => {
  const targets = [
    { id: 4, position: 0.5 },
    { id: 2, position: -0.5 },
    { id: 1, position: 0.5 },
  ];
  expect(createTargetIndex(targets).nearest(0)).toEqual({
    id: 1,
    position: 0.5,
  });
});

it('matches a brute-force oracle for shuffled randomized positions, duplicates, boundaries and distance ties', () => {
  let state = 12345;
  const random = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
  for (let trial = 0; trial < 100; trial += 1) {
    const targets = Array.from(
      { length: 1 + Math.floor(random() * 100) },
      (_, id) => ({ id: id + 1, position: Math.floor(random() * 21) / 10 - 1 }),
    );
    targets.reverse();
    const index = createTargetIndex(targets);
    for (let query = 0; query < 50; query += 1) {
      const position = random() * 2 - 1;
      const expected = [...targets].sort(
        (a, b) =>
          Math.abs(a.position - position) - Math.abs(b.position - position) ||
          a.id - b.id,
      )[0];
      expect(index.nearest(position)).toBe(expected);
    }
  }
});

it('resolves floating-point distance plateaus by ID, not only adjacent positions', () => {
  const targets = [
    { id: 1, position: 0 },
    { id: 2, position: 1e-30 },
    { id: 3, position: 1e-20 },
  ];
  const index = createTargetIndex(targets);
  expect(index.nearest(1)).toBe(targets[0]);
});

it('bounds position reads and numeric comparisons below quadratic growth for 4000 targets and queries', () => {
  let reads = 0;
  const targets = Array.from({ length: 4000 }, (_, id) => ({
    id,
    get position() {
      reads += 1;
      return id / 2000 - 1;
    },
  }));
  const index = createTargetIndex(targets);
  let comparisons = 0;
  for (let query = 0; query < 4000; query += 1) {
    // A numeric-coercion probe counts real comparisons without mocking the index.
    const position = {
      [Symbol.toPrimitive]() {
        comparisons += 1;
        return query / 2000 - 1;
      },
    };
    expect(index.nearest(position as unknown as number).id).toBe(query);
  }
  expect(reads).toBeLessThan(200_000);
  expect(comparisons).toBeGreaterThan(4000);
  expect(comparisons).toBeLessThan(400_000);
});
