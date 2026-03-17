import $ from 'jquery';
import Chessboard from 'chessboardjs';
import type { ChessboardInstance } from 'chessboardjs';
import type { SerializedGame, ColorCode } from '../../../../shared/types';
import { colorName } from '../../../../shared/colors';
import { on } from '../../events/index';
import type { GameEventData, NavPosition } from '../../events/index';
import { drawMove, clearArrows } from './arrows';
import { initResize } from './resize';
import copyFen from '../../utils/fen';
import { isReplayMode } from '../replay/index';

let board: ChessboardInstance | null = null;
let pvBoardWhite: ChessboardInstance | null = null;
let pvBoardBlack: ChessboardInstance | null = null;
let live = true;
let flipped = false;
let lastGameData: SerializedGame | null = null;
let navFollowup: string | null = null;
let navKibitzerAlg: string | null = null;
let navThinkingAlg: string | null = null;
let navMoveColor: ColorCode | null = null;

const WHITE_ARROW_COLOR = '#DDDDDDDD';
const BLACK_ARROW_COLOR = '#222222DD';
const KIBITZER_ARROW_LIGHT = '#114F8ADD';
const KIBITZER_ARROW_DARK = '#68C07BDD';
const EMPTY_FEN = '8/8/8/8/8/8/8/8';

function updatePvBoards(fens: { white: string; black: string }) {
  pvBoardWhite!.position(fens.white, false);
  pvBoardBlack!.position(fens.black, false);
}

function getLivePvFens(game: SerializedGame): { white: string; black: string } {
  const liveColor = colorName(game.liveData.color);
  const otherColor = colorName(game.liveData.color === 'w' ? 'b' : 'w');
  const moves = game.moves || [];
  const lastMeta = moves.length ? moves[moves.length - 1] : null;

  return {
    [liveColor]: game.liveData.pvFen,
    [otherColor]: lastMeta?.pvFen || EMPTY_FEN,
  } as { white: string; black: string };
}

function parseHexColor(hex: string): [number, number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const a = hex.length >= 9 ? parseInt(hex.slice(7, 9), 16) : 255;
  return [r, g, b, a];
}

function blendColors(colors: string[]): string {
  const parsed = colors.map(parseHexColor);
  const n = parsed.length;
  const r = Math.round(parsed.reduce((s, c) => s + c[0], 0) / n);
  const g = Math.round(parsed.reduce((s, c) => s + c[1], 0) / n);
  const b = Math.round(parsed.reduce((s, c) => s + c[2], 0) / n);
  const a = Math.round(parsed.reduce((s, c) => s + c[3], 0) / n);
  return `#${[r, g, b, a].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

function drawArrows() {
  clearArrows();
  if (!lastGameData) return;

  const theme = localStorage.getItem('theme') || 'light';
  const kibitzerArrowColor = theme === 'dark' ? KIBITZER_ARROW_DARK : KIBITZER_ARROW_LIGHT;

  let kMove: string;
  let fMove: string;
  let tMove: string;
  let tMoveColor: string;
  let fMoveColor: string;

  if (live) {
    const { pvAlg = '', color } = lastGameData.liveData;
    const moves = lastGameData.moves || [];
    const lastMeta = moves.length ? moves[moves.length - 1] : null;

    kMove = lastGameData.kibitzerLiveData?.pvAlg || '';
    fMove = lastMeta?.pvFollowup || '';
    tMove = pvAlg;
    tMoveColor = color === 'w' ? WHITE_ARROW_COLOR : BLACK_ARROW_COLOR;
    fMoveColor = color === 'w' ? BLACK_ARROW_COLOR : WHITE_ARROW_COLOR;
  } else {
    kMove = navKibitzerAlg || '';
    fMove = navFollowup || '';
    tMove = navThinkingAlg || '';
    tMoveColor = navMoveColor === 'w' ? WHITE_ARROW_COLOR : BLACK_ARROW_COLOR;
    fMoveColor = navMoveColor === 'w' ? BLACK_ARROW_COLOR : WHITE_ARROW_COLOR;
  }

  // Group arrows by move and blend overlapping colors
  const arrowMap = new Map<string, string[]>();
  const addArrow = (move: string, color: string) => {
    const existing = arrowMap.get(move);
    if (existing) existing.push(color);
    else arrowMap.set(move, [color]);
  };
  if (kMove) addArrow(kMove, kibitzerArrowColor);
  if (fMove) addArrow(fMove, fMoveColor);
  if (tMove) addArrow(tMove, tMoveColor);

  for (const [move, colors] of arrowMap) {
    drawMove(move, colors.length === 1 ? colors[0] : blendColors(colors), flipped);
  }
}

function handleGameUpdate(data: GameEventData) {
  if (isReplayMode()) return;

  const { game } = data;

  lastGameData = game;

  // Board position is controlled by nav:position event
  if (live) {
    updatePvBoards(getLivePvFens(game));
  }

  drawArrows();
}

function handleGameState(data: GameEventData) {
  const { game } = data;
  lastGameData = game;

  if (live) {
    updatePvBoards(getLivePvFens(game));
  }

  drawArrows();
}

function handleThemeChange() {
  drawArrows();
}

function highlightSquares(lastMove: { from: string; to: string } | null) {
  $('#board .highlight').removeClass('highlight');
  if (lastMove) {
    $(`#board [data-square="${lastMove.from}"]`).addClass('highlight');
    $(`#board [data-square="${lastMove.to}"]`).addClass('highlight');
  }
}

function getPvFenAtIndex(navIndex: number): { white: string; black: string } {
  if (!lastGameData || navIndex <= 0) return { white: EMPTY_FEN, black: EMPTY_FEN };

  const moves = lastGameData.moves || [];
  if (navIndex > moves.length) return { white: EMPTY_FEN, black: EMPTY_FEN };

  const halfIdx = navIndex - 1;
  const moved = moves[halfIdx];
  const movedColor = colorName(moved.color);
  const otherColor = colorName(moved.color === 'w' ? 'b' : 'w');

  return {
    [movedColor]: moved.pvFen || EMPTY_FEN,
    [otherColor]: halfIdx > 0 ? moves[halfIdx - 1].pvFen || EMPTY_FEN : EMPTY_FEN,
  } as { white: string; black: string };
}

function getFollowupAtIndex(navIndex: number) {
  if (!lastGameData || navIndex <= 0) return null;
  const moves = lastGameData.moves || [];
  if (navIndex > moves.length) return null;
  return moves[navIndex - 1].pvFollowup || null;
}

function getKibitzerAlgAtIndex(navIndex: number): string | null {
  if (!lastGameData || navIndex <= 0) return null;
  const moves = lastGameData.moves || [];
  if (navIndex >= moves.length) return null;
  return moves[navIndex].kibitzer?.pvAlg || null;
}

function getThinkingAlgAtIndex(navIndex: number): string | null {
  if (!lastGameData || navIndex <= 0) return null;
  const moves = lastGameData.moves || [];
  if (navIndex >= moves.length) return null;
  return moves[navIndex].pvAlg || null;
}

function getNavMoveColor(navIndex: number): ColorCode | null {
  if (!lastGameData || navIndex <= 0) return null;
  const moves = lastGameData.moves || [];
  if (navIndex >= moves.length) return null;
  return moves[navIndex].color || null;
}

function handleNavPosition({ fen, isLive, lastMove, index }: NavPosition) {
  const wasLive = live;
  live = isLive;
  board!.position(fen);
  highlightSquares(lastMove);

  navFollowup = isLive ? null : getFollowupAtIndex(index);
  navKibitzerAlg = isLive ? null : getKibitzerAlgAtIndex(index);
  navThinkingAlg = isLive ? null : getThinkingAlgAtIndex(index);
  navMoveColor = isLive ? null : getNavMoveColor(index);

  if (!isLive) {
    updatePvBoards(getPvFenAtIndex(index));
  } else if (!wasLive && lastGameData) {
    updatePvBoards(getLivePvFens(lastGameData));
  }

  drawArrows();
}

export function init() {
  // Initialize main board
  board = Chessboard('board', { pieceTheme: '/img/{piece}.svg', showNotation: true });

  // Initialize arrow canvas
  clearArrows();
  const b = $('#board');
  $('#arrow-board').attr('height', b.height()!).height(b.height()!).attr('width', b.width()!).width(b.width()!);

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
  on('board:resize', () => drawArrows());
  on('board:flip', (data) => {
    flipped = data.flipped;
    const orientation = flipped ? 'black' : 'white';
    board!.orientation(orientation);
    pvBoardWhite!.orientation(orientation);
    pvBoardBlack!.orientation(orientation);
    drawArrows();
  });
}

export function resize() {
  if (board) board.resize();

  const b = $('#board');
  $('#arrow-board').attr('height', b.height()!).height(b.height()!).attr('width', b.width()!).width(b.width()!);
  drawArrows();
}

export function getBoards() {
  return { board, pvBoardWhite, pvBoardBlack };
}
