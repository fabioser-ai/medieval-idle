import Phaser from 'phaser';

export const LOGICAL_WIDTH = 480;
export const LOGICAL_HEIGHT = 270;

export function createGame(parent: HTMLElement): Phaser.Game {
  return new Phaser.Game({
    type: Phaser.AUTO,
    width: LOGICAL_WIDTH,
    height: LOGICAL_HEIGHT,
    parent,
    pixelArt: true,
    antialias: false,
    transparent: false,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
  });
}
