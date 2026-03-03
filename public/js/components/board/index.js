// public/js/components/board/index.js
import Chessboard from 'chessboardjs';
import { on, emit } from '../../events/index.js';
import { drawMove, clearArrows } from './arrows.js';
import { initResize, chatHeight } from './resize.js';

let board = null;
let pvBoardWhite = null;
let pvBoardBlack = null;

export function init() {
  // Initialize main board
  board = Chessboard('board', { pieceTheme: '/img/{piece}.svg', showNotation: false });

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

  // Initialize resize
  initResize(board, pvBoardWhite, pvBoardBlack);

  // Listen for game updates
  on('game:update', handleGameUpdate);
  on('game:state', handleGameState);
  on('theme:change', handleThemeChange);
}

function handleGameUpdate(data) {
  const { game } = data;

  board.position(game.fen);
  pvBoardWhite.position(game.white.pvFen, false);
  pvBoardBlack.position(game.black.pvFen, false);

  clearArrows();

  const theme = localStorage.getItem('theme') || 'light';
  const mainArrowColor = theme === 'dark' ? '#68C07BEE' : '#114F8AEE';
  const secondaryArrowColor = theme === 'dark' ? '#F3AE4888' : '#F3AE4888';

  const { pvAlg: stmPvAlg = [] } = game[game.stm === 'w' ? 'white' : 'black'];
  const { pvAlg: xstmPvAlg = [] } = game[game.stm === 'w' ? 'black' : 'white'];

  const sameMove = stmPvAlg[0] === xstmPvAlg[1] ? 1 : 0;
  if (xstmPvAlg[1]) drawMove(xstmPvAlg[1], secondaryArrowColor, 1 * sameMove);
  if (stmPvAlg[0]) drawMove(stmPvAlg[0], mainArrowColor, -1 * sameMove);
}

function handleGameState(data) {
  handleGameUpdate(data);
}

function handleThemeChange() {
  clearArrows();
}

export function resize() {
  if (board) board.resize();
  if (pvBoardWhite) pvBoardWhite.resize();
  if (pvBoardBlack) pvBoardBlack.resize();

  const b = $('#board');
  $('#arrow-board').attr('height', b.height()).height(b.height()).attr('width', b.width()).width(b.width());
  clearArrows();
}

export function getBoards() {
  return { board, pvBoardWhite, pvBoardBlack };
}

export default { init, resize, getBoards };
