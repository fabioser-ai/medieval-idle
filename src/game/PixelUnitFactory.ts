import type { ArmySide, UnitType } from '../domain/army';
import { UNIT_TYPES } from '../domain/army';
import type Phaser from 'phaser';
interface PixelRect {
  x: number;
  y: number;
  width: number;
  height: number;
  color: number;
}
export function unitPixels(
  type: UnitType,
  side: ArmySide,
  frame: number,
  action: 'march' | 'attack',
): PixelRect[] {
  const pixels: PixelRect[] = [];
  const rect = (
    x: number,
    y: number,
    width: number,
    height: number,
    color: number,
  ) => pixels.push({ x, y, width, height, color });
  const dark = side === 'left' ? 0x243b50 : 0x312c33;
  const team = side === 'left' ? 0x4b9dce : 0xc55c51;
  const metal = side === 'left' ? 0xc2d5db : 0x85888a;
  const attacking = action === 'attack' && frame === 1;
  const leg = frame === 1 ? 1 : 0;
  if (type === 'cavalry') {
    rect(3, 12, 12, 5, dark);
    rect(4, 12, 10, 3, 0x8a6854);
    rect(13, 9, 4, 6, 0x8a6854);
    rect(15, 8, 3, 3, 0xb09270);
    rect(4 + leg, 16, 2, 3, dark);
    rect(11 - leg, 16, 2, 3, dark);
    rect(1, 13 + leg, 3, 1, dark);
    rect(8, 7, 4, 6, team);
    rect(8, 3, 4, 4, metal);
    rect(11, 5, 2, 2, 0xe3b58a);
    rect(12, attacking ? 6 : 3, attacking ? 8 : 1, attacking ? 1 : 9, metal);
  } else {
    rect(7 - leg, 15, 2, 4, dark);
    rect(11 + leg, 15, 2, 4, dark);
    rect(6, 8, 8, 8, dark);
    rect(7, 8, 6, 6, team);
    rect(7, 3, 6, 5, metal);
    rect(11, 5, 3, 3, 0xe3b58a);
    rect(12, 5, 1, 1, dark);
    if (type === 'infantry') {
      rect(5, 10, 5, 6, metal);
      rect(6, 11, 3, 4, team);
      rect(
        attacking ? 13 : 14,
        attacking ? 9 : 5,
        attacking ? 7 : 1,
        attacking ? 1 : 8,
        metal,
      );
    } else if (type === 'spearman') {
      rect(
        attacking ? 10 : 15,
        attacking ? 9 : 1,
        attacking ? 10 : 1,
        attacking ? 1 : 17,
        0xb99a6a,
      );
      rect(attacking ? 18 : 14, attacking ? 8 : 0, 2, 2, metal);
      rect(5, 10, 3, 5, metal);
    } else {
      rect(7, 3, 6, 3, team);
      rect(14, 7, 1, 10, 0xb99a6a);
      rect(15, 8, 1, 1, 0xb99a6a);
      rect(16, 9, 1, 6, 0xb99a6a);
      rect(15, 15, 1, 1, 0xb99a6a);
      rect(attacking ? 11 : 13, 11, attacking ? 8 : 4, 1, metal);
    }
  }
  return pixels;
}

export function textureKey(
  type: UnitType,
  side: ArmySide,
  action: 'march' | 'attack',
  frame: number,
): string {
  return `${side}-${type}-${action}-${frame}`;
}

/** Only texture baking depends on Phaser. Pixel geometry remains DOM-free. */
export function createUnitTextures(scene: Phaser.Scene): void {
  const graphics = scene.add.graphics();
  for (const side of ['left', 'right'] as const)
    for (const type of UNIT_TYPES)
      for (const action of ['march', 'attack'] as const)
        for (const frame of [0, 1]) {
          const key = textureKey(type, side, action, frame);
          if (scene.textures.exists(key)) continue;
          graphics.clear();
          for (const pixel of unitPixels(type, side, frame, action))
            graphics
              .fillStyle(pixel.color)
              .fillRect(pixel.x, pixel.y, pixel.width, pixel.height);
          graphics.generateTexture(key, 20, 20);
        }
  graphics.destroy();
}
