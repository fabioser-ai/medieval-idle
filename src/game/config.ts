import Phaser from 'phaser';
import { BattleScene } from './BattleScene';

export const LOGICAL_WIDTH = 480;
export const LOGICAL_HEIGHT = 270;

export function createGame(
  parent: HTMLElement,
  onReady?: (scene: BattleScene) => void,
): Phaser.Game {
  return new Phaser.Game({
    type: Phaser.AUTO,
    width: LOGICAL_WIDTH,
    height: LOGICAL_HEIGHT,
    parent,
    pixelArt: true,
    antialias: false,
    roundPixels: true,
    scene: [new BattleScene(onReady)],
    transparent: false,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
  });
}
