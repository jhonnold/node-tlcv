// public/js/components/game/index.js
import { on } from '../../events/index.js';
import { updateTimers, stopAllTimers } from './timers.js';
import { update, updateSpectators, updateMenu } from './player-info.js';
import copyFen from '../../utils/fen.js';

let live = true;

function handleGameUpdate(data) {
  const { game, spectators, menu } = data;

  if (live) {
    update(game);
    updateTimers(data);
  }
  updateSpectators(spectators);
  updateMenu(menu);
}

function handleGameState(data) {
  live = true;
  handleGameUpdate(data);
}

export function init() {
  on('game:update', handleGameUpdate);
  on('game:state', handleGameState);
  on('nav:position', ({ isLive }) => {
    live = isLive;
  });

  // Setup FEN copy
  $('#copy-fen-btn').on('click', copyFen);
}

export function destroy() {
  stopAllTimers();
  $('#copy-fen-btn').off('click');
}

export default { init, destroy };
