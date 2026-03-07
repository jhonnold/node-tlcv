// public/js/components/game/index.js
import { on } from '../../events/index.js';
import { updateTimers, stopAllTimers, hideTimers, forceRestartTimers } from './timers.js';
import { update, updateHistoricalInfo, updateSpectators, updateMenu } from './player-info.js';
import copyFen from '../../utils/fen.js';

let live = true;
let lastGameData = null;

function getMoveMetaAtIndex(navIndex) {
  if (!lastGameData || navIndex <= 0) return { movedColor: null, movedMeta: null, otherColor: null, otherMeta: null };

  const moves = lastGameData.moves || [];
  if (navIndex > moves.length) return { movedColor: null, movedMeta: null, otherColor: null, otherMeta: null };

  const halfIdx = navIndex - 1;
  const moved = moves[halfIdx];
  const movedColor = moved.color === 'w' ? 'white' : 'black';
  const otherColor = moved.color === 'w' ? 'black' : 'white';
  const movedMeta = moved.depth !== null ? moved : null;

  const other = halfIdx > 0 ? moves[halfIdx - 1] : null;
  const otherMeta = other?.depth != null ? other : null;

  return { movedColor, movedMeta, otherColor, otherMeta };
}

function handleGameUpdate(data) {
  const { game, spectators, menu } = data;

  lastGameData = game;

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

function handleNavPosition({ isLive, index }) {
  const wasLive = live;
  live = isLive;

  if (isLive) {
    // Restore live display
    if (!wasLive && lastGameData) {
      update(lastGameData);
      forceRestartTimers({ game: lastGameData });
    }
    return;
  }

  // Historical position: show per-move data
  hideTimers();

  const { movedColor, movedMeta, otherColor, otherMeta } = getMoveMetaAtIndex(index);
  if (movedColor) {
    updateHistoricalInfo(movedColor, movedMeta);
    updateHistoricalInfo(otherColor, otherMeta);
  } else {
    // navIndex 0 (start position)
    updateHistoricalInfo('white', null);
    updateHistoricalInfo('black', null);
  }
}

export function init() {
  on('game:update', handleGameUpdate);
  on('game:state', handleGameState);
  on('nav:position', handleNavPosition);

  // Setup FEN copy
  $('#copy-fen-btn').on('click', copyFen);
}

export function destroy() {
  stopAllTimers();
  $('#copy-fen-btn').off('click');
}

export default { init, destroy };
