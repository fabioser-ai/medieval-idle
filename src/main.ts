import './styles.css';
import { createGame } from './game/config';

const gameHost = document.querySelector<HTMLElement>('#game');

if (!gameHost) {
  throw new Error('Missing game host.');
}

gameHost.setAttribute(
  'aria-label',
  'The Two Hills: a pixel battlefield demo. Space pauses or resumes playback.',
);
createGame(gameHost);
