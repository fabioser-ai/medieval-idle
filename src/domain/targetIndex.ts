interface Target {
  readonly id: number;
  readonly position: number;
}
interface Entry<T> {
  readonly id: number;
  readonly position: number;
  readonly unit: T;
}

/** Immutable position snapshot, built in O(n log n); exact nearest lookup in O(log n). */
export function createTargetIndex<T extends Target>(
  targets: readonly T[],
): { nearest(position: number): T } {
  if (targets.length === 0)
    throw new Error('A target index requires at least one target.');
  const sorted = targets
    .map((unit) => ({ id: unit.id, position: unit.position, unit }))
    .sort((a, b) => a.position - b.position || a.id - b.id);
  const entries = sorted.filter(
    (entry, index) =>
      index === 0 || entry.position !== sorted[index - 1].position,
  );
  let size = 1;
  while (size < entries.length) size *= 2;
  const tree: (Entry<T> | undefined)[] = new Array(size * 2);
  const lowerId = (a: Entry<T> | undefined, b: Entry<T> | undefined) =>
    !a ? b : !b || a.id < b.id ? a : b;
  entries.forEach((entry, index) => {
    tree[size + index] = entry;
  });
  for (let index = size - 1; index > 0; index -= 1)
    tree[index] = lowerId(tree[index * 2], tree[index * 2 + 1]);
  const first = (predicate: (entry: Entry<T>) => boolean) => {
    let low = 0;
    let high = entries.length;
    while (low < high) {
      const middle = (low + high) >>> 1;
      if (predicate(entries[middle])) high = middle;
      else low = middle + 1;
    }
    return low;
  };
  return {
    nearest(position: number): T {
      if (entries.length === 1) return entries[0].unit;
      const insertion = first((entry) => entry.position >= position);
      const distance = Math.min(
        insertion === entries.length
          ? Infinity
          : Math.abs(entries[insertion].position - position),
        insertion === 0
          ? Infinity
          : Math.abs(entries[insertion - 1].position - position),
      );
      // Rounded floating-point distances can tie across more than two neighboring
      // positions. Find the entire minimum-distance interval, then its minimum ID.
      let left = size + first((entry) => position - entry.position <= distance);
      let right = size + first((entry) => entry.position - position > distance);
      let best: Entry<T> | undefined;
      while (left < right) {
        if (left & 1) best = lowerId(best, tree[left++]);
        if (right & 1) best = lowerId(best, tree[--right]);
        left >>>= 1;
        right >>>= 1;
      }
      return best!.unit;
    },
  };
}
