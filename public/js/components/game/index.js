// public/js/components/game/index.js
import { on } from '../../events/index.js';
import { updateTimers, stopAllTimers, hideTimers, forceRestartTimers } from './timers.js';
import { update, updateHistoricalInfo, hidePv, updateSpectators, updateMenu } from './player-info.js';
import copyFen from '../../utils/fen.js';

let live = true;
let lastGameData = null;

function getMoveMetaAtIndex(navIndex) {
  if (!lastGameData || navIndex <= 0) return { movedColor: null, movedMeta: null, otherColor: null, otherMeta: null };

  const game = lastGameData;
  const sanMoves = game.moves || [];
  const startFen = game.startFen || null;

  if (navIndex > sanMoves.length) return { movedColor: null, movedMeta: null, otherColor: null, otherMeta: null };

  const blackStarts = startFen ? startFen.split(' ')[1] === 'b' : false;
  const startMoveNum = startFen ? parseInt(startFen.split(' ')[5], 10) || 1 : 1;
  const halfMoveOffset = blackStarts ? 1 : 0;

  // The half-move index of the move that was just played
  const halfIdx = navIndex - 1;
  const globalHalfMove = halfIdx + halfMoveOffset;
  const moveNum = startMoveNum + Math.floor(globalHalfMove / 2);
  const isWhiteMove = globalHalfMove % 2 === 0;

  const movedColor = isWhiteMove ? 'white' : 'black';
  const otherColor = isWhiteMove ? 'black' : 'white';

  const movedMoves = game[movedColor].moves || [];
  const otherMoves = game[otherColor].moves || [];

  // Find meta for the moved side at this move number
  const movedMeta = movedMoves.find((m) => m.number === moveNum) || null;

  // Find the most recent meta for the other side before this point
  // If white just moved at moveNum N, black's last move was at N-1
  // If black just moved at moveNum N, white's last move was at N
  const otherMaxNum = isWhiteMove ? moveNum - 1 : moveNum;
  let otherMeta = null;
  for (let i = otherMoves.length - 1; i >= 0; i -= 1) {
    if (otherMoves[i].number <= otherMaxNum) {
      otherMeta = otherMoves[i];
      break;
    }
  }

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
  hidePv('white');
  hidePv('black');

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
