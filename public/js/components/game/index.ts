import $ from 'jquery';
import type { SerializedGame } from '../../../../shared/types';
import { colorName } from '../../../../shared/colors';
import { on } from '../../events/index';
import type { GameEventData, NavPosition } from '../../events/index';
import { updateTimers, stopAllTimers, hideTimers, forceRestartTimers } from './timers';
import { update, updateHistoricalInfo, updateSpectators, updateMenu } from './player-info';
import copyFen from '../../utils/fen';
import { isReplayMode } from '../replay/index';

let live = true;
let lastGameData: SerializedGame | null = null;

function getMoveMetaAtIndex(navIndex: number) {
  if (!lastGameData || navIndex <= 0) return { movedColor: null, movedMeta: null, otherColor: null, otherMeta: null };

  const moves = lastGameData.moves || [];
  if (navIndex > moves.length) return { movedColor: null, movedMeta: null, otherColor: null, otherMeta: null };

  const halfIdx = navIndex - 1;
  const moved = moves[halfIdx];
  const movedColor = colorName(moved.color);
  const otherColor = colorName(moved.color === 'w' ? 'b' : 'w');
  const movedMeta = moved.depth !== null ? moved : null;

  const other = halfIdx > 0 ? moves[halfIdx - 1] : null;
  const otherMeta = other?.depth != null ? other : null;

  return { movedColor, movedMeta, otherColor, otherMeta };
}

function handleGameUpdate(data: GameEventData) {
  if (isReplayMode()) return;

  const { game, spectators, menu } = data;

  lastGameData = game;

  if (live) {
    update(game);
    updateTimers(data);
  }
  updateSpectators(spectators);
  updateMenu(menu);
}

function handleGameState(data: GameEventData) {
  const { game, spectators, menu } = data;

  live = true;
  lastGameData = game;
  update(game);
  if (isReplayMode()) {
    hideTimers();
  } else {
    updateTimers(data);
  }
  updateSpectators(spectators);
  updateMenu(menu);
}

function handleNavPosition({ isLive, index }: NavPosition) {
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
  $('#copy-fen-btn').on('click', () => copyFen($('#fen').text()));
  $('#board-fen').on('click', () => copyFen($('#fen').text()));
}

export function destroy() {
  stopAllTimers();
  $('#copy-fen-btn').off('click');
  $('#board-fen').off('click');
}
