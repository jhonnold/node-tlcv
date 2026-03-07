// public/js/components/board/index.js
import Chessboard from 'chessboardjs';
import { on } from '../../events/index.js';
import { drawMove, clearArrows } from './arrows.js';
import { initResize } from './resize.js';
import copyFen from '../../utils/fen.js';

let board = null;
let pvBoardWhite = null;
let pvBoardBlack = null;
let live = true;
let lastGameData = null;
let navFollowup = null;

const SECONDARY_ARROW_COLOR = '#F3AE4888';
const EMPTY_FEN = '8/8/8/8/8/8/8/8';

function getLivePvFens(game) {
  const liveColor = game.liveData.color === 'w' ? 'white' : 'black';
  const otherColor = game.liveData.color === 'w' ? 'black' : 'white';
  const moves = game.moves || [];
  const lastMeta = moves.length ? moves[moves.length - 1] : null;

  return {
    [liveColor]: game.liveData.pvFen,
    [otherColor]: lastMeta?.pvFen || EMPTY_FEN,
  };
}

function drawArrows() {
  clearArrows();
  if (!lastGameData) return;

  if (!live) {
    if (navFollowup) drawMove(navFollowup, SECONDARY_ARROW_COLOR);
    return;
  }

  const theme = localStorage.getItem('theme') || 'light';
  const mainArrowColor = theme === 'dark' ? '#68C07BEE' : '#114F8AEE';

  const { pvAlg = [] } = lastGameData.liveData;
  const moves = lastGameData.moves || [];
  const lastMeta = moves.length ? moves[moves.length - 1] : null;
  const followup = lastMeta?.pvFollowup || null;

  const sameMove = pvAlg[0] === followup ? 1 : 0;
  if (followup) drawMove(followup, SECONDARY_ARROW_COLOR, 1 * sameMove);
  if (pvAlg[0]) drawMove(pvAlg[0], mainArrowColor, -1 * sameMove);
}

function handleGameUpdate(data) {
  const { game } = data;

  lastGameData = game;

  // Board position is controlled by nav:position event
  if (live) {
    const pvFens = getLivePvFens(game);
    pvBoardWhite.position(pvFens.white, false);
    pvBoardBlack.position(pvFens.black, false);
  }

  drawArrows();
}

function handleGameState(data) {
  handleGameUpdate(data);
}

function handleThemeChange() {
  drawArrows();
}

function highlightSquares(lastMove) {
  $('#board .highlight').removeClass('highlight');
  if (lastMove) {
    $(`#board [data-square="${lastMove.from}"]`).addClass('highlight');
    $(`#board [data-square="${lastMove.to}"]`).addClass('highlight');
  }
}

function getPvFenAtIndex(navIndex) {
  if (!lastGameData || navIndex <= 0) return { white: EMPTY_FEN, black: EMPTY_FEN };

  const moves = lastGameData.moves || [];
  if (navIndex > moves.length) return { white: EMPTY_FEN, black: EMPTY_FEN };

  const halfIdx = navIndex - 1;
  const moved = moves[halfIdx];
  const movedColor = moved.color === 'w' ? 'white' : 'black';
  const otherColor = moved.color === 'w' ? 'black' : 'white';

  return {
    [movedColor]: moved.pvFen || EMPTY_FEN,
    [otherColor]: halfIdx > 0 ? moves[halfIdx - 1].pvFen || EMPTY_FEN : EMPTY_FEN,
  };
}

function getFollowupAtIndex(navIndex) {
  if (!lastGameData || navIndex <= 0) return null;
  const moves = lastGameData.moves || [];
  if (navIndex > moves.length) return null;
  return moves[navIndex - 1].pvFollowup || null;
}

function handleNavPosition({ fen, isLive, lastMove, index }) {
  const wasLive = live;
  live = isLive;
  board.position(fen);
  highlightSquares(lastMove);

  navFollowup = isLive ? null : getFollowupAtIndex(index);

  if (!isLive) {
    const pvFens = getPvFenAtIndex(index);
    pvBoardWhite.position(pvFens.white, false);
    pvBoardBlack.position(pvFens.black, false);
  } else if (!wasLive && lastGameData) {
    // Restore PV boards when returning to live
    const pvFens = getLivePvFens(lastGameData);
    pvBoardWhite.position(pvFens.white, false);
    pvBoardBlack.position(pvFens.black, false);
  }

  drawArrows();
}

export function init() {
  // Initialize main board
  board = Chessboard('board', { pieceTheme: '/img/{piece}.svg', showNotation: true });

  // Initialize arrow canvas
  clearArrows();
  const b = $('#board');
  $('#arrow-board').attr('height', b.height()).height(b.height()).attr('width', b.width()).width(b.width());

  // Initialize PV boards
  const pvBoardSettings = {
    pieceTheme: '/img/{piece}.svg',
    showNotation: false,
  };
  pvBoardWhite = Chessboard('white-pv-board', pvBoardSettings);
  pvBoardBlack = Chessboard('black-pv-board', pvBoardSettings);

  // Click PV boards to copy their FEN (only when live)
  $('#white-pv-board').on('click', () => live && lastGameData && copyFen(getLivePvFens(lastGameData).white));
  $('#black-pv-board').on('click', () => live && lastGameData && copyFen(getLivePvFens(lastGameData).black));

  // Initialize resize
  initResize(board, pvBoardWhite, pvBoardBlack);

  // Listen for game updates
  on('game:update', handleGameUpdate);
  on('game:state', handleGameState);
  on('theme:change', handleThemeChange);
  on('nav:position', handleNavPosition);
  on('board:resize', drawArrows);
}

export function resize() {
  if (board) board.resize();

  const b = $('#board');
  $('#arrow-board').attr('height', b.height()).height(b.height()).attr('width', b.width()).width(b.width());
  drawArrows();
}

export function getBoards() {
  return { board, pvBoardWhite, pvBoardBlack };
}

export default { init, resize, getBoards };
