// public/js/components/focus/index.js
import $ from 'jquery';
import { resize as resizeBoard } from '../board/index';
import { chatHeight } from '../board/resize';
import { on, off } from '../../events/index';
import type { GameEventData, NavPosition } from '../../events/index';
import type { SerializedGame } from '../../../../shared/types';
import { colorName } from '../../../../shared/colors';
import { formatScore } from '../game/player-info';
import { msToString } from '../game/timers';
import { isReplayMode } from '../replay/index';

let active = false;
let flipped = false;
let live = true;
let navIndex = 0;
let lastGame: SerializedGame | null = null;
const focusClockIntervals = new Map<string, ReturnType<typeof setInterval>>();

function topColor(): 'white' | 'black' {
  return flipped ? 'white' : 'black';
}

function bottomColor(): 'white' | 'black' {
  return flipped ? 'black' : 'white';
}

function clearFocusClocks() {
  focusClockIntervals.forEach((interval) => clearInterval(interval));
  focusClockIntervals.clear();
}

function renderStrip(color: 'white' | 'black', game: SerializedGame) {
  const isTop = color === topColor();
  const $strip = $(isTop ? '#focus-info-top' : '#focus-info-bottom');

  // Name
  $strip.find('.focus-name').text(game[color].name);

  // Eval — mirrors the logic in player-info.ts update()
  const liveColor = colorName(game.liveData.color);
  let scoreText = '--';

  if (live) {
    if (color === liveColor) {
      // Thinking side: use the live engine evaluation (white-perspective; formatScore negates for black)
      scoreText = formatScore(game.liveData.score, color);
    } else {
      // Non-thinking side: show the eval from the most recent completed move
      const moves = game.moves || [];
      const lastMeta = moves.length ? moves[moves.length - 1] : null;
      if (lastMeta && lastMeta.depth !== null && lastMeta.score != null) {
        scoreText = formatScore(lastMeta.score, color);
      }
    }
  } else {
    // Historical navigation: search backward for the most recent eval for this color
    const colorChar = color === 'white' ? 'w' : 'b';
    const moves = game.moves || [];
    for (let i = Math.min(navIndex - 1, moves.length - 1); i >= 0; i--) {
      const move = moves[i];
      if (move.color === colorChar && move.score != null) {
        scoreText = formatScore(move.score, color);
        break;
      }
    }
  }

  $strip.find('.focus-score').text(scoreText);
}

function startFocusClock(color: 'white' | 'black', game: SerializedGame) {
  const isTop = color === topColor();
  const $time = $(isTop ? '#focus-info-top .focus-time' : '#focus-info-bottom .focus-time');

  const { clockTime, startTime } = game[color];

  if (!live || isReplayMode() || clockTime === 0) {
    $time.text('--:--');
    return;
  }

  const sideToMove = game.stm === 'w' ? 'white' : 'black';
  if (color === sideToMove) {
    // Ticking clock for the side-to-move
    const tick = () => {
      const remaining = Math.max(0, clockTime - (Date.now() - startTime));
      $time.text(msToString(remaining));
    };
    tick();
    focusClockIntervals.set(color, setInterval(tick, 1000));
  } else {
    // Static remaining time for the waiting side
    $time.text(msToString(clockTime));
  }
}

function render(game: SerializedGame) {
  if (!active) return;
  clearFocusClocks();
  renderStrip(topColor(), game);
  renderStrip(bottomColor(), game);
  startFocusClock(topColor(), game);
  startFocusClock(bottomColor(), game);
}

function handleGameState(data: GameEventData) {
  live = true;
  lastGame = data.game;
  render(data.game);
}

function handleGameUpdate(data: GameEventData) {
  if (isReplayMode()) return;
  live = true;
  lastGame = data.game;
  render(data.game);
}

function handleNavPosition({ isLive, index }: NavPosition) {
  live = isLive;
  navIndex = index;
  if (lastGame) render(lastGame);
}

function handleFlip({ flipped: f }: { flipped: boolean }) {
  flipped = f;
  if (lastGame) render(lastGame);
}

function toggle() {
  active = !active;
  document.body.classList.toggle('focus-mode', active);

  // Let the layout settle before reading dimensions
  setTimeout(() => {
    resizeBoard();
    if (!active) {
      clearFocusClocks();
      $('#chat-area').height(chatHeight());
    } else if (lastGame) {
      render(lastGame);
    }
  }, 50);
}

function handleKeyDown(e: JQuery.KeyDownEvent) {
  if (e.key === 'Escape' && active) {
    toggle();
  }
}

export function init() {
  $('#focus-toggle').on('click', toggle);
  $(document).on('keydown', handleKeyDown);

  on('game:state', handleGameState);
  on('game:update', handleGameUpdate);
  on('nav:position', handleNavPosition);
  on('board:flip', handleFlip);
}

export function destroy() {
  $('#focus-toggle').off('click');
  $(document).off('keydown', handleKeyDown);
  clearFocusClocks();
  off('game:state', handleGameState);
  off('game:update', handleGameUpdate);
  off('nav:position', handleNavPosition);
  off('board:flip', handleFlip);
}
