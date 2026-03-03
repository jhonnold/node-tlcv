// public/js/components/game/index.js
import { on } from '../../events/index.js';
import { updateTimers, stopAllTimers } from './timers.js';
import { update, updateSpectators, updateMenu } from './player-info.js';
import copyFen from '../../utils/fen.js';

function handleGameUpdate(data) {
  const { game, spectators, menu } = data;

  update(game);
  updateTimers(data);
  updateSpectators(spectators);
  updateMenu(menu);
}

function handleGameState(data) {
  handleGameUpdate(data);
}

export function init() {
  on('game:update', handleGameUpdate);
  on('game:state', handleGameState);

  // Setup FEN copy
  $('#fen-tooltip').on('click', copyFen);
}

export function destroy() {
  stopAllTimers();
  $('#fen-tooltip').off('click');
  // Note: event handlers are automatically cleaned up via the unsubscribe function
}

export default { init, destroy };
