import './styles.css';
import { createGame } from './game/config';
import { mountDeployment } from './ui/deploymentView';

const gameHost = document.querySelector<HTMLElement>('#game');

if (!gameHost) {
  throw new Error('Missing game host.');
}

gameHost.setAttribute(
  'aria-label',
  'The Two Hills pixel battlefield. Battle playback controls are below the deployment panel.',
);
const uiHost = document.querySelector<HTMLElement>('#battle-ui');
if (!uiHost) throw new Error('Missing deployment host.');
createGame(gameHost, (scene) => mountDeployment(uiHost, scene));
