import type { BattleResult } from '../src/domain/battleEvents';

/** Small-fixture assertions only. Large replay logs must be streamed or seeked. */
export function materializeBattle(result: BattleResult) {
  return { ...result, events: [...result.events] };
}
