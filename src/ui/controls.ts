import {
  BattleSession,
  type PlaybackSpeed,
} from '../application/battleSession';
import type { BattleResult } from '../domain/battleEvents';
import { demoArmies } from '../game/demoBattle';
import type { DeploymentEditor } from './deployment';
export interface ViewingControls {
  setPlaybackSpeed(speed: PlaybackSpeed): void;
}
export interface BattleRenderer extends ViewingControls {
  play(result: BattleResult): void;
}
export class BattleController {
  #started = false;
  readonly viewing: ViewingControls;
  constructor(
    private readonly editor: DeploymentEditor,
    private readonly renderer: BattleRenderer,
  ) {
    this.viewing = Object.freeze({
      setPlaybackSpeed: (speed: PlaybackSpeed) => {
        if (!this.#started) throw new Error('Please start a battle first.');
        if (![0, 1, 2, 4].includes(speed))
          throw new RangeError('Invalid playback speed.');
        this.renderer.setPlaybackSpeed(speed);
      },
    });
  }
  start(): void {
    if (this.#started) throw new Error('Battle already started.');
    const deployment = this.editor.lock();
    const [, enemy] = demoArmies();
    // Small prototype inventory only. Session is not retained or advanced:
    // the scene's cinematic renderer clock is the sole playback authority.
    const result = new BattleSession().start(deployment, enemy, 626);
    this.renderer.play(result);
    this.#started = true;
    this.viewing.setPlaybackSpeed(1);
  }
}
