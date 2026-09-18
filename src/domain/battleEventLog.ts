import type { BattleEvent, BattleEventLog } from './battleEvents';

const CHUNK_SIZE = 4096;
const BYTES_PER_EVENT = 25;
interface Chunk {
  kind: Uint8Array;
  actor: Uint16Array;
  target: Uint16Array;
  numbers: Uint32Array;
  auxiliary: Float64Array;
}

/**
 * Internal writer for validated simulation IDs <= 4,000 and ticks <= 100,000.
 * Tick runs and dictionary references preserve every Float64 value losslessly.
 */
export class BattleEventLogBuilder {
  #chunks: Chunk[] = [];
  #length = 0;
  #closed = false;
  #numbers: number[] = [];
  #numberIndices = new Map<number | '-0', number>();
  #runStarts: number[] = [];
  #runTicks: number[] = [];

  #intern(value: number): number {
    const key = Object.is(value, -0) ? '-0' : value;
    const existing = this.#numberIndices.get(key);
    if (existing !== undefined) return existing;
    const index = this.#numbers.length;
    this.#numbers.push(value);
    this.#numberIndices.set(key, index);
    return index;
  }

  push(event: BattleEvent): void {
    if (this.#closed)
      throw new Error('An immutable event log cannot be appended to.');
    if (this.#runTicks.at(-1) !== event.tick) {
      this.#runStarts.push(this.#length);
      this.#runTicks.push(event.tick);
    }
    const index = this.#length % CHUNK_SIZE;
    if (index === 0)
      this.#chunks.push({
        kind: new Uint8Array(CHUNK_SIZE),
        actor: new Uint16Array(CHUNK_SIZE),
        target: new Uint16Array(CHUNK_SIZE),
        numbers: new Uint32Array(CHUNK_SIZE * 3),
        auxiliary: new Float64Array(CHUNK_SIZE),
      });
    const chunk = this.#chunks[this.#chunks.length - 1];
    const value = index * 3;
    switch (event.type) {
      case 'gate-opened':
        chunk.kind[index] = event.side === 'left' ? 0 : 1;
        break;
      case 'march-started':
        chunk.kind[index] = event.side === 'left' ? 2 : 3;
        break;
      case 'charge-started':
        chunk.kind[index] = event.side === 'left' ? 4 : 5;
        chunk.actor[index] = event.unitId;
        chunk.target[index] = event.targetId;
        chunk.numbers[value] = this.#intern(event.position);
        chunk.auxiliary[index] = event.distance;
        break;
      case 'attack':
        chunk.kind[index] = 6;
        chunk.actor[index] = event.attackerId;
        chunk.target[index] = event.targetId;
        chunk.numbers[value] = this.#intern(event.damage);
        chunk.auxiliary[index] = event.randomFactor;
        chunk.numbers[value + 1] = this.#intern(event.attackerPosition);
        chunk.numbers[value + 2] = this.#intern(event.targetPosition);
        break;
      case 'death':
        chunk.kind[index] = event.side === 'left' ? 7 : 8;
        chunk.actor[index] = event.unitId;
        chunk.numbers[value] = this.#intern(event.position);
        break;
      case 'battle-ended':
        chunk.kind[index] =
          event.winner === 'left' ? 9 : event.winner === 'right' ? 10 : 11;
        break;
    }
    this.#length += 1;
  }

  finish(): BattleEventLog {
    this.#closed = true;
    const chunks = this.#chunks;
    const length = this.#length;
    const numbers = Float64Array.from(this.#numbers);
    const runStarts = Uint32Array.from(this.#runStarts);
    const runTicks = Uint32Array.from(this.#runTicks);
    const decode = (index: number, tick: number): BattleEvent => {
      const chunk = chunks[Math.floor(index / CHUNK_SIZE)];
      const offset = index % CHUNK_SIZE;
      const kind = chunk.kind[offset];
      const actor = chunk.actor[offset];
      const value = offset * 3;
      let event: BattleEvent;
      if (kind <= 1)
        event = {
          type: 'gate-opened',
          side: kind === 0 ? 'left' : 'right',
          tick,
        };
      else if (kind <= 3)
        event = {
          type: 'march-started',
          side: kind === 2 ? 'left' : 'right',
          tick,
        };
      else if (kind <= 5)
        event = {
          type: 'charge-started',
          tick,
          unitId: actor,
          targetId: chunk.target[offset],
          side: kind === 4 ? 'left' : 'right',
          position: numbers[chunk.numbers[value]],
          distance: chunk.auxiliary[offset],
        };
      else if (kind === 6)
        event = {
          type: 'attack',
          tick,
          attackerId: actor,
          targetId: chunk.target[offset],
          damage: numbers[chunk.numbers[value]],
          randomFactor: chunk.auxiliary[offset],
          attackerPosition: numbers[chunk.numbers[value + 1]],
          targetPosition: numbers[chunk.numbers[value + 2]],
        };
      else if (kind <= 8)
        event = {
          type: 'death',
          tick,
          unitId: actor,
          side: kind === 7 ? 'left' : 'right',
          position: numbers[chunk.numbers[value]],
        };
      else
        event = {
          type: 'battle-ended',
          tick,
          outcome: kind === 11 ? 'draw' : 'victory',
          winner: kind === 9 ? 'left' : kind === 10 ? 'right' : null,
        };
      return Object.freeze(event);
    };
    return Object.freeze({
      length,
      byteLength:
        chunks.length * CHUNK_SIZE * BYTES_PER_EVENT +
        numbers.byteLength +
        runStarts.byteLength +
        runTicks.byteLength,
      at(rawIndex: number) {
        const integer = Number.isNaN(rawIndex) ? 0 : Math.trunc(rawIndex);
        const index = integer < 0 ? length + integer : integer;
        if (index < 0 || index >= length) return undefined;
        let low = 0;
        let high = runStarts.length;
        while (low < high) {
          const middle = (low + high) >>> 1;
          if (runStarts[middle] <= index) low = middle + 1;
          else high = middle;
        }
        return decode(index, runTicks[low - 1]);
      },
      findTick(tick: number) {
        let low = 0;
        let high = runTicks.length;
        while (low < high) {
          const middle = (low + high) >>> 1;
          if (runTicks[middle] < tick) low = middle + 1;
          else high = middle;
        }
        return low === runStarts.length ? length : runStarts[low];
      },
      *[Symbol.iterator]() {
        let run = 0;
        for (let index = 0; index < length; index += 1) {
          if (runStarts[run + 1] === index) run += 1;
          yield decode(index, runTicks[run]);
        }
      },
    });
  }
}
