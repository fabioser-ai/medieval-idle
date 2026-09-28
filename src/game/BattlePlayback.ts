import type { BattlePhase, PlaybackSpeed } from '../application/battleSession';
import type { BattleEvent, BattleResult } from '../domain/battleEvents';
import { COMBAT_TUNING } from '../domain/combatRules';
import {
  aggregateUnits,
  displayedUnitPoint,
  EventCursor,
  type VisualCohort,
} from './battlePresentation';

export interface PresentedUnit extends VisualCohort {
  position: number;
  destination: number;
  charged: boolean;
  fighting: boolean;
  attackUntil: number;
  dying: boolean;
  deathAt: number;
  visible: boolean;
  returnFrom: number;
}
export interface Arrow {
  active: boolean;
  from: { x: number; y: number };
  to: { x: number; y: number };
  born: number;
}

/** Presentation only: accepts an already-computed result, never runs simulation.
 * At most 800 visual records, 64 projectiles and one streamed event at a time.
 * Overloaded frames drain the same tick before moving the visual clock ahead. */
export class BattlePlayback {
  phase: BattlePhase = 'preparing';
  time = 0;
  units: PresentedUnit[] = [];
  readonly arrows: Arrow[] = Array.from({ length: 64 }, () => ({
    active: false,
    from: { x: 0, y: 0 },
    to: { x: 0, y: 0 },
    born: 0,
  }));
  counts = { left: 0, right: 0 };
  winner: 'left' | 'right' | null = null;
  private readonly cursor = new EventCursor(4096);
  private byUnitId = new Map<number, number>();
  private readonly dead = new Set<number>();
  private endAt: number | null = null;
  private returnAt = 0;
  private arrowIndex = 0;
  private readonly cinematicLeadIn = 1800;
  get eventCount(): number {
    return this.cursor.length;
  }
  get eventIndex(): number {
    return this.cursor.index;
  }

  load(result: BattleResult): void {
    this.clear();
    const aggregation = aggregateUnits(result.initialUnits);
    this.byUnitId = aggregation.byUnitId;
    this.units = aggregation.views.map((v) => ({
      ...v,
      position: v.unit.position,
      destination:
        (v.unit.side === 'left' ? -1 : 1) *
        COMBAT_TUNING.unitStats[v.unit.type].range *
        0.025,
      charged: false,
      fighting: false,
      attackUntil: 0,
      dying: false,
      deathAt: 0,
      visible: true,
      returnFrom: v.unit.position,
    }));
    for (const unit of result.initialUnits) this.counts[unit.side]++;
    this.cursor.attach(result.events);
    this.phase = 'gates';
  }

  advance(milliseconds: number, speed: PlaybackSpeed): void {
    if (!Number.isFinite(milliseconds) || milliseconds < 0)
      throw new RangeError('Invalid playback delta');
    if (speed === 0 || this.phase === 'preparing') return;
    const delta = this.cursor.pending ? 0 : milliseconds * speed;
    this.time += delta;
    for (const unit of this.units) {
      unit.fighting = unit.attackUntil > this.time;
      if (unit.dying) {
        if (this.time - unit.deathAt >= 280) unit.visible = false;
      } else if (this.phase === 'returning') {
        const progress = Math.min(1, (this.time - this.returnAt) / 3000);
        unit.position =
          unit.returnFrom + (unit.unit.position - unit.returnFrom) * progress;
      } else if (this.phase !== 'gates' && this.phase !== 'result') {
        const stats = COMBAT_TUNING.unitStats[unit.unit.type];
        const step =
          (delta / 1000) *
          stats.moveSpeed *
          0.05 *
          (unit.charged ? (unit.unit.type === 'cavalry' ? 1.45 : 1.18) : 0.42);
        const distance = unit.destination - unit.position;
        unit.position +=
          Math.sign(distance) * Math.min(step, Math.abs(distance));
      }
    }
    for (const arrow of this.arrows)
      if (this.time - arrow.born > 500) arrow.active = false;
    if (this.time >= this.cinematicLeadIn && this.endAt === null)
      this.cursor.drain((this.time - this.cinematicLeadIn) / 50, (event) =>
        this.consume(event),
      );
    if (this.endAt !== null) this.cursor.clear();
    if (
      this.endAt !== null &&
      this.phase === 'result' &&
      this.time - this.endAt >= 1000
    ) {
      this.phase = 'returning';
      this.returnAt = this.time;
      for (const unit of this.units) unit.returnFrom = unit.position;
    }
    if (this.phase === 'returning' && this.time - this.returnAt >= 3000)
      this.clear();
  }

  private getUnit(id: number): PresentedUnit | undefined {
    const index = this.byUnitId.get(id);
    return index === undefined ? undefined : this.units[index];
  }

  private consume(event: BattleEvent): void {
    switch (event.type) {
      case 'gate-opened':
        break;
      case 'march-started':
        this.phase = 'marching';
        break;
      case 'charge-started': {
        const unit = this.getUnit(event.unitId);
        if (unit) {
          unit.charged = true;
        }
        if (this.phase !== 'fighting') this.phase = 'charging';
        break;
      }
      case 'attack': {
        const unit = this.getUnit(event.attackerId);
        const target = this.getUnit(event.targetId);
        if (unit && !unit.dying) {
          unit.fighting = true;
          // Event anchors steer the rendered position; they never teleport it.
          // Later attack/target anchors include pursuit after earlier contact.
          unit.destination = event.attackerPosition;
          // Coalesces many simulation attacks onto one visual attack pulse.
          if (unit.attackUntil <= this.time) {
            unit.attackUntil = this.time + 220;
            if (unit.unit.type === 'archer' && target) {
              const arrow = this.arrows[this.arrowIndex++ % this.arrows.length];
              Object.assign(arrow.from, displayedUnitPoint(unit));
              Object.assign(arrow.to, displayedUnitPoint(target));
              Object.assign(arrow, {
                active: true,
                born: this.time,
              });
            }
          }
        }
        if (target && !target.dying) target.destination = event.targetPosition;
        this.phase = 'fighting';
        break;
      }
      case 'death': {
        if (this.dead.has(event.unitId)) break;
        this.dead.add(event.unitId);
        this.counts[event.side]--;
        const unit = this.getUnit(event.unitId);
        if (unit && --unit.aliveCount === 0) {
          unit.dying = true;
          unit.deathAt = this.time;
          unit.position = event.position;
        }
        break;
      }
      case 'battle-ended':
        this.phase = 'result';
        this.winner = event.winner;
        this.endAt = this.time;
        // The log has no further presentation use; drop its large packed storage.
        break;
    }
  }

  clear(): void {
    this.cursor.clear();
    this.byUnitId.clear();
    this.dead.clear();
    this.units = [];
    this.phase = 'preparing';
    this.time = 0;
    this.endAt = null;
    this.returnAt = 0;
    this.counts = { left: 0, right: 0 };
    this.winner = null;
    this.arrowIndex = 0;
    for (const arrow of this.arrows) arrow.active = false;
  }
}
