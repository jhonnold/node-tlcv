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

function drawArrows() {
  clearArrows();
  if (!live || !lastGameData) return;

  const theme = localStorage.getItem('theme') || 'light';
  const mainArrowColor = theme === 'dark' ? '#68C07BEE' : '#114F8AEE';
  const secondaryArrowColor = theme === 'dark' ? '#F3AE4888' : '#F3AE4888';

  const { pvAlg: stmPvAlg = [] } = lastGameData[lastGameData.stm === 'w' ? 'white' : 'black'];
  const { pvAlg: xstmPvAlg = [] } = lastGameData[lastGameData.stm === 'w' ? 'black' : 'white'];

  const sameMove = stmPvAlg[0] === xstmPvAlg[1] ? 1 : 0;
  if (xstmPvAlg[1]) drawMove(xstmPvAlg[1], secondaryArrowColor, 1 * sameMove);
  if (stmPvAlg[0]) drawMove(stmPvAlg[0], mainArrowColor, -1 * sameMove);
}

function handleGameUpdate(data) {
  const { game } = data;

  lastGameData = game;

  // Board position is controlled by nav:position event
  pvBoardWhite.position(game.white.pvFen, false);
  pvBoardBlack.position(game.black.pvFen, false);

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

function handleNavPosition({ fen, isLive, lastMove }) {
  live = isLive;
  board.position(fen);
  highlightSquares(lastMove);
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

  // Click PV boards to copy their FEN
  $('#white-pv-board').on('click', () => lastGameData && copyFen(lastGameData.white.pvFen));
  $('#black-pv-board').on('click', () => lastGameData && copyFen(lastGameData.black.pvFen));

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
