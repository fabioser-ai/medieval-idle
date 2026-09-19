import Phaser from 'phaser';
import type { PlaybackSpeed } from '../application/battleSession';
import type { BattleResult } from '../domain/battleEvents';
import { BattlePlayback } from './BattlePlayback';
import {
  displayedUnitPoint,
  densityLabel,
  unitFrame,
} from './battlePresentation';
import { createUnitTextures, textureKey } from './PixelUnitFactory';
import { UnitViewPool } from './UnitViewPool';
import { BattleAudio } from './BattleAudio';

/** Thin Phaser adapter; all event/state/allocation behavior lives outside Phaser. */
export class BattleScene extends Phaser.Scene {
  readonly playback = new BattlePlayback();
  playbackSpeed: PlaybackSpeed = 1;
  private pool!: UnitViewPool<Phaser.GameObjects.Image>;
  private readonly sprites = new Map<number, Phaser.GameObjects.Image>();
  private arrows!: Phaser.GameObjects.Graphics;
  private armyMass!: Phaser.GameObjects.Graphics;
  private gates: Phaser.GameObjects.Rectangle[] = [];
  private leftBadge!: Phaser.GameObjects.Text;
  private rightBadge!: Phaser.GameObjects.Text;
  private status!: Phaser.GameObjects.Text;
  private prompt!: Phaser.GameObjects.Text;
  private progress!: Phaser.GameObjects.Rectangle;
  private duration = 1;
  private battleFinishedHandler: (() => void) | undefined;
  private battleResultHandler: (() => void) | undefined;
  private cleanedUp = false;

  constructor(
    private readonly onReady?: (scene: BattleScene) => void,
    private readonly audio = new BattleAudio(),
  ) {
    super('BattleScene');
  }

  create(): void {
    this.cleanedUp = false;
    this.cameras.main.setRoundPixels(true);
    this.drawBattlefield();
    createUnitTextures(this);
    this.pool = new UnitViewPool(
      800,
      () => this.add.image(0, 0, 'left-infantry-march-0').setOrigin(0.5, 1),
      (view) =>
        view
          .setVisible(false)
          .setActive(false)
          .setAlpha(1)
          .setAngle(0)
          .setScale(1),
    );
    this.armyMass = this.add.graphics().setDepth(260);
    this.arrows = this.add.graphics().setDepth(450);
    this.drawLabels();
    const cleanup = () => {
      if (this.cleanedUp) return;
      this.cleanedUp = true;
      this.events.off(Phaser.Scenes.Events.SHUTDOWN, cleanup);
      this.events.off(Phaser.Scenes.Events.DESTROY, cleanup);
      this.playback.clear();
      this.pool.releaseAll();
      this.sprites.clear();
      this.battleFinishedHandler = undefined;
      this.battleResultHandler = undefined;
      this.audio.stop();
    };
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, cleanup);
    this.events.once(Phaser.Scenes.Events.DESTROY, cleanup);
    this.onReady?.(this);
  }

  /** Task 7 / worker integration boundary: pass a completed session result here.
   * No large simulation is performed by this method. Old sources are released. */
  play(result: BattleResult): void {
    this.pool.releaseAll();
    this.sprites.clear();
    this.playback.load(result);
    this.duration = result.durationTicks * 50 + 800;
    for (const unit of this.playback.units) {
      const sprite = this.pool.acquire(unit.id);
      sprite.setTexture(textureKey(unit.unit.type, unit.unit.side, 'march', 0));
      sprite.setFlipX(unit.unit.side === 'right').setActive(true);
      this.sprites.set(unit.id, sprite);
    }
  }

  setPlaybackSpeed(speed: PlaybackSpeed): void {
    if (![0, 1, 2, 4].includes(speed))
      throw new RangeError('Invalid playback speed.');
    this.playbackSpeed = speed;
    this.audio.setPaused(speed === 0);
  }

  startAudioFromGesture(): void {
    this.audio.startFromGesture();
  }
  setBattleResultHandler(handler: () => void): void {
    this.battleResultHandler = handler;
  }

  /** Replaces the single preparation-owner callback; does not add listeners. */
  setBattleFinishedHandler(handler: () => void): void {
    this.battleFinishedHandler = handler;
  }

  update(_time: number, delta: number): void {
    if (!this.pool) return;
    const previousPhase = this.playback.phase;
    this.playback.advance(Math.min(delta, 100), this.playbackSpeed);
    const { phase, time } = this.playback;
    this.audio.update({
      phase,
      time,
      ...this.playback.counts,
      cavalry: this.playback.units
        .filter((u) => !u.dying && u.unit.type === 'cavalry')
        .reduce((n, u) => n + u.aliveCount, 0),
      arrows: this.playback.arrows.filter((a) => a.active).length,
      attacks: this.playback.units.filter(
        (u) => !u.dying && u.attackUntil > time,
      ).length,
      winner: this.playback.winner,
    });
    if (previousPhase !== 'result' && phase === 'result')
      this.battleResultHandler?.();
    this.game.canvas.dataset.phase = phase;
    this.game.canvas.dataset.playbackTime = String(time);
    this.drawArmyMass();
    for (const unit of this.playback.units) {
      const sprite = this.sprites.get(unit.id);
      if (!sprite) continue;
      if (!unit.visible) {
        this.pool.release(unit.id);
        this.sprites.delete(unit.id);
        continue;
      }
      const point = displayedUnitPoint(unit);
      const side = unit.unit.side === 'left' ? 1 : -1;
      const action = unit.attackUntil > time ? 'attack' : 'march';
      const frame = phase === 'gates' ? 0 : unitFrame(time, unit.id);
      sprite.setTexture(
        textureKey(unit.unit.type, unit.unit.side, action, frame),
      );
      sprite.setPosition(point.x, point.y).setDepth(point.y + 100).setScale(0.72);
      // Keep even the horse silhouette inside the closed gate aperture. Release
      // the edge crop gradually as its anchor leaves the gate, and fold it on return.
      const gateX = unit.unit.side === 'left' ? 59 : 419;
      const crop = Math.max(0, 3 - Math.abs(point.x - gateX));
      sprite.setCrop(crop, 0, 20 - crop * 2, 20);
      sprite.setVisible(true);
      sprite.setFlipX(
        phase === 'returning'
          ? unit.unit.side === 'left'
          : unit.unit.side === 'right',
      );
      if (unit.dying) {
        const fade = Math.min(1, (time - unit.deathAt) / 280);
        sprite.setAngle(side * fade * 90).setAlpha(1 - fade);
      }
    }
    if (phase === 'preparing' && this.sprites.size) {
      this.pool.releaseAll();
      this.sprites.clear();
    }
    const gateOpen = phase === 'preparing' ? 0 : Math.min(1, time / 650);
    for (const gate of this.gates) gate.setScale(1, 1 - gateOpen);
    this.drawArrows();
    const shown = { left: 0, right: 0 };
    for (const unit of this.playback.units)
      if (!unit.dying) shown[unit.unit.side]++;
    this.leftBadge.setText(densityLabel(this.playback.counts.left, shown.left));
    this.rightBadge.setText(
      densityLabel(this.playback.counts.right, shown.right),
    );
    const label =
      phase === 'result'
        ? this.playback.winner
          ? `${this.playback.winner === 'left' ? 'ALDERWATCH' : 'EMBERFALL'} VICTORIOUS`
          : 'HONORS EVEN'
        : phase.toUpperCase();
    this.status.setText(this.playbackSpeed === 0 ? 'PAUSED' : label);
    this.prompt.setText(
      phase === 'preparing'
        ? 'FIELD AT REST'
        : `VIEW ONLY · ${this.playbackSpeed === 0 ? 'PAUSED' : `${this.playbackSpeed}×`}`,
    );
    this.progress.setScale(Math.min(1, time / this.duration), 1);
    if (previousPhase === 'returning' && phase === 'preparing') {
      this.audio.stop();
      this.battleFinishedHandler?.();
    }
  }

  private drawArmyMass(): void {
    this.armyMass.clear();
    const phase = this.playback.phase;
    const active = !['preparing', 'gates'].includes(phase);
    if (!active) return;
    for (const unit of this.playback.units) {
      if (!unit.visible || unit.dying || unit.aliveCount <= 1) continue;
      const p = displayedUnitPoint(unit);
      const color = unit.unit.side === 'left' ? 0x7fb5d1 : 0xd98a72;
      const dark = unit.unit.side === 'left' ? 0x416f8a : 0x8d4e42;
      const count = Math.min(18, Math.max(2, Math.ceil(Math.sqrt(unit.aliveCount) * 2.2)));
      const side = unit.unit.side === 'left' ? 1 : -1;
      const charge = phase === 'charging' ? 1.7 : 1;
      for (let i = 0; i < count; i++) {
        const row = Math.floor(i / 6);
        const col = i % 6;
        const jitter = ((unit.id * 17 + i * 11) % 5) - 2;
        const x = p.x - side * (col * 3.2 * charge + 3) + jitter * 0.35;
        const y = p.y + (row - 1) * 2.8 + (((i + unit.id) % 3) - 1) * 0.45;
        this.armyMass.fillStyle(i % 4 === 0 ? dark : color, 0.92);
        this.armyMass.fillRect(Math.round(x), Math.round(y), 2, 2);
      }
    }
  }

  private drawArrows(): void {
    this.arrows.clear().lineStyle(1, 0xf2db9b, 0.95);
    for (const arrow of this.playback.arrows) {
      if (!arrow.active) continue;
      const t = Math.min(1, (this.playback.time - arrow.born) / 500);
      const a = arrow.from;
      const b = arrow.to;
      const x = Math.round(a.x + (b.x - a.x) * t);
      const y = Math.round(
        a.y + (b.y - a.y) * t - Math.sin(t * Math.PI) * 28 - 12,
      );
      const direction = b.x > a.x ? 1 : -1;
      this.arrows.lineBetween(x, y, x - direction * 5, y + 1);
    }
  }

  private text(
    x: number,
    y: number,
    text: string,
    size: number,
    color: string,
  ): Phaser.GameObjects.Text {
    return this.add
      .text(x, y, text, {
        fontFamily: 'monospace',
        fontSize: `${size}px`,
        color,
        padding: { x: 0, y: 0 },
      })
      .setDepth(600)
      .setResolution(1);
  }

  private drawLabels(): void {
    this.add.rectangle(240, 23, 480, 46, 0x182c35).setDepth(500);
    this.add.rectangle(240, 46, 480, 1, 0x57655b).setDepth(500);
    this.text(15, 10, 'ALDERWATCH', 10, '#9ac4dc');
    this.text(465, 10, 'EMBERFALL', 10, '#e2a38d').setOrigin(1, 0);
    this.leftBadge = this.text(15, 26, '', 7, '#cad4cb');
    this.rightBadge = this.text(465, 26, '', 7, '#cad4cb').setOrigin(1, 0);
    this.text(240, 9, 'THE TWO HILLS', 8, '#e2d8b6').setOrigin(0.5, 0);
    this.status = this.text(240, 26, '', 6, '#a4b7aa').setOrigin(0.5, 0);
    this.add.rectangle(240, 257, 480, 26, 0x182c35).setDepth(500);
    this.add.rectangle(240, 244, 480, 1, 0x57655b).setDepth(500);
    this.text(15, 253, 'FIELD NOTES / 01', 7, '#a6b7a8');
    this.text(240, 253, 'PIXEL COMBAT PROTOTYPE', 6, '#748d86').setOrigin(
      0.5,
      0,
    );
    this.prompt = this.text(465, 253, '', 7, '#e3d3a4').setOrigin(1, 0);
    this.progress = this.add
      .rectangle(0, 243, 480, 1, 0xdac98a)
      .setOrigin(0, 0)
      .setDepth(510)
      .setScale(0, 1);
  }

  private drawBattlefield(): void {
    const g = this.add.graphics();
    const rect = (color: number, x: number, y: number, w: number, h: number) =>
      g.fillStyle(color).fillRect(x, y, w, h);
    const polygon = (color: number, points: number[]) => {
      g.fillStyle(color).beginPath().moveTo(points[0], points[1]);
      for (let i = 2; i < points.length; i += 2)
        g.lineTo(points[i], points[i + 1]);
      g.closePath().fillPath();
    };
    rect(0x9baaa1, 0, 0, 480, 270);
    rect(0xbcc4ac, 0, 75, 480, 60);
    rect(0xd5cfac, 0, 113, 480, 67);
    rect(0xe8d7a6, 303, 66, 22, 22);
    rect(0xe8d7a6, 299, 70, 30, 14);
    for (const [x, y, w] of [
      [120, 69, 45],
      [200, 86, 28],
      [351, 63, 30],
      [31, 63, 25],
    ]) {
      rect(0xd1d2b8, x, y, w, 3);
      rect(0xd1d2b8, x + 8, y - 3, w - 15, 3);
    }
    polygon(
      0x8c9e95,
      [
        0, 151, 33, 101, 74, 130, 130, 76, 175, 131, 225, 92, 285, 145, 344,
        101, 380, 132, 437, 88, 480, 134, 480, 195, 0, 195,
      ],
    );
    polygon(
      0x778f83,
      [
        0, 158, 61, 120, 109, 152, 176, 125, 226, 164, 302, 115, 366, 157, 418,
        121, 480, 154, 480, 208, 0, 208,
      ],
    );
    polygon(
      0x607e6d,
      [
        0, 174, 95, 159, 149, 168, 221, 151, 296, 169, 369, 145, 480, 168, 480,
        229, 0, 229,
      ],
    );
    rect(0x6e8657, 0, 194, 480, 76);
    // Broad flat center with stepped, grass-edged hills on both sides.
    polygon(
      0x435d40,
      [
        0, 147, 68, 146, 103, 160, 148, 190, 184, 204, 296, 204, 332, 190, 377,
        160, 412, 146, 480, 147, 480, 270, 0, 270,
      ],
    );
    polygon(
      0x779652,
      [
        0, 141, 67, 141, 103, 154, 148, 184, 184, 200, 296, 200, 332, 184, 377,
        154, 413, 141, 480, 141, 480, 236, 0, 236,
      ],
    );
    polygon(
      0x879f5c,
      [
        0, 142, 66, 142, 104, 158, 149, 188, 184, 203, 296, 203, 332, 188, 376,
        158, 414, 142, 480, 142, 480, 150, 414, 150, 376, 166, 332, 195, 296,
        210, 184, 210, 149, 195, 104, 166, 66, 150, 0, 150,
      ],
    );
    polygon(
      0x9c9c66,
      [
        56, 147, 68, 147, 115, 178, 169, 206, 240, 217, 311, 206, 365, 178, 412,
        147, 424, 147, 368, 186, 314, 217, 240, 226, 166, 217, 112, 186,
      ],
    );
    for (let i = 0; i < 92; i++) {
      const x = (i * 71 + 13) % 480;
      const y = 218 + ((i * 17) % 24);
      rect(i % 3 === 0 ? 0x9cad68 : 0x627e48, x, y, (i % 4) + 1, 1);
    }
    // Blue stone keep: shaded masonry, crenellations, pennant and inset gate.
    rect(0x414f50, 14, 105, 61, 42);
    rect(0x8d9990, 12, 103, 59, 40);
    rect(0xa4aea0, 12, 103, 59, 4);
    rect(0x697b77, 14, 125, 56, 3);
    for (let y = 111; y < 142; y += 7)
      for (let x = 15 + (y % 2) * 4; x < 69; x += 11)
        rect(0x788a82, x, y, 8, 1);
    for (const x of [10, 61]) {
      rect(0x9ca89a, x, 91, 13, 54);
      rect(0x72857e, x + 10, 92, 4, 54);
      for (let n = 0; n < 3; n++) rect(0xb1b8a8, x + n * 5, 88, 3, 6);
      rect(0x344c4c, x + 5, 102, 3, 8);
    }
    for (let x = 25; x < 60; x += 7) rect(0xaab4a5, x, 99, 4, 5);
    rect(0x314946, 52, 125, 15, 22);
    rect(0xb3b8a0, 51, 123, 17, 3);
    rect(0x534b3b, 35, 72, 1, 27);
    rect(0x4d98b8, 36, 73, 17, 9);
    rect(0xb3d0d3, 36, 73, 2, 9);
    // Red timber fort with pointed palisade, beams and watchtower.
    for (let x = 404; x < 474; x += 5) {
      rect(0x6e5641, x, 114, 4, 33);
      rect(0x9c7750, x, 112, 2, 35);
      polygon(0xa38258, [x, 112, x + 2, 108, x + 4, 112]);
    }
    rect(0x594a3b, 405, 122, 70, 3);
    rect(0x594a3b, 405, 139, 70, 3);
    rect(0x4a4435, 411, 125, 16, 23);
    rect(0xb08c5b, 409, 122, 20, 3);
    rect(0x654e3c, 448, 91, 4, 54);
    rect(0x654e3c, 467, 91, 4, 54);
    rect(0xa17b50, 445, 99, 29, 12);
    rect(0x493e34, 452, 93, 16, 6);
    polygon(0x59453a, [440, 94, 459, 80, 478, 94]);
    rect(0xad8060, 443, 93, 32, 2);
    rect(0x534b3b, 437, 80, 1, 32);
    rect(0xb75c48, 420, 81, 17, 9);
    rect(0xda9c78, 435, 81, 2, 9);
    this.gates = [
      this.add.rectangle(59, 125, 14, 22, 0x655b44),
      this.add.rectangle(419, 125, 14, 22, 0x574637),
    ];
    for (const gate of this.gates) gate.setOrigin(0.5, 0).setDepth(400);
    // Tiny foreground reeds and rocks break up the repeated grass pattern.
    for (const x of [19, 97, 344, 455]) {
      rect(0x405d40, x, 232, 1, 7);
      rect(0x405d40, x + 3, 230, 1, 9);
      rect(0x556b43, x + 6, 234, 1, 5);
    }
    rect(0x8b9473, 139, 226, 7, 3);
    rect(0x626e57, 142, 229, 5, 2);
  }
}
