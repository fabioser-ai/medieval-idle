import './styles.css';
import { createGame } from './game/config';

const gameHost = document.querySelector<HTMLElement>('#game');

if (!gameHost) {
  throw new Error('Missing game host.');
}

createGame(gameHost);
