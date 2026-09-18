export class UnitViewPool<T> {
  readonly totalCreated: number;
  private readonly free: T[] = [];
  private readonly active = new Map<number, T>();

  /** Warm once. Exhaustion is explicit, never an allocation in a hot frame. */
  constructor(
    capacity: number,
    create: () => T,
    private readonly reset: (view: T) => void,
  ) {
    if (!Number.isSafeInteger(capacity) || capacity < 1)
      throw new RangeError('Invalid pool capacity');
    for (let i = 0; i < capacity; i++) {
      const view = create();
      reset(view);
      this.free.push(view);
    }
    this.totalCreated = capacity;
  }
  get activeCount(): number {
    return this.active.size;
  }
  acquire(id: number): T {
    const existing = this.active.get(id);
    if (existing !== undefined) return existing;
    const view = this.free.pop();
    if (view === undefined) throw new Error('Unit view pool capacity exceeded');
    this.active.set(id, view);
    return view;
  }
  release(id: number): void {
    const view = this.active.get(id);
    if (view === undefined) return;
    this.reset(view);
    this.active.delete(id);
    this.free.push(view);
  }
  releaseAll(): void {
    for (const id of this.active.keys()) this.release(id);
  }
}
