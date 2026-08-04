import $ from 'jquery';
import { Chess } from 'chess.js';
import Chessboard from 'chessboardjs';
import type { ChessboardInstance } from 'chessboardjs';
import type { SerializedGame, MoveMetaData, ColorCode } from '../../../../shared/types';
import { colorName } from '../../../../shared/colors';
import { on } from '../../events/index';
import type { GameEventData, NavPosition } from '../../events/index';
import { drawMove, clearArrows, sizeArrowBoard } from './arrows';
import { initResize } from './resize';
import copyFen, { EMPTY_FEN } from '../../utils/fen';
import { getCssVar } from '../../utils/dom';
import { blendColors } from '../../utils/color';
import { isReplayMode } from '../replay/index';
import { getPieceSet } from '../theme/index';
import { applyPieceSet, pieceSrc } from '../theme/piece-sets';
import type { PieceSetId } from '../theme/piece-sets';
import { themeDefault } from '../theme/presets';

const BOARD_SELECTORS = ['#board', '#white-pv-board', '#black-pv-board'];

let board: ChessboardInstance | null = null;
let pvBoardWhite: ChessboardInstance | null = null;
let pvBoardBlack: ChessboardInstance | null = null;
let live = true;
let flipped = false;
let lastGameData: SerializedGame | null = null;
// Historical position: the move the engines were thinking about (moves[index])
// and the one before it (moves[index - 1]), which carries the followup arrow.
let navMove: MoveMetaData | null = null;
let navPrevMove: MoveMetaData | null = null;
let navFen = '';

// Arrow colors come from CSS custom properties, which cost a getComputedStyle to
// read. They only change with the theme, so resolve them once and refresh on
// `theme:change` rather than on every draw.
let arrowColors = { white: '', black: '', kibitzer: '' };

function refreshArrowColors() {
  arrowColors = {
    white: getCssVar('--whiteArrowColor', themeDefault('--whiteArrowColor')),
    black: getCssVar('--blackArrowColor', themeDefault('--blackArrowColor')),
    kibitzer: getCssVar('--kibitzerArrowColor', themeDefault('--kibitzerArrowColor')),
  };
}

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

type ArrowSources = {
  kMove: string;
  fMove: string;
  tMove: string;
  stm: ColorCode | null;
  fen: string;
};

/** The three candidate arrows for the currently displayed position. */
function arrowSources(): ArrowSources | null {
  if (!lastGameData) return null;

  if (live) {
    const { pvAlg = '', color } = lastGameData.liveData;
    const moves = lastGameData.moves || [];
    const lastMeta = moves.length ? moves[moves.length - 1] : null;

    return {
      kMove: lastGameData.kibitzerLiveData?.pvAlg || '',
      fMove: lastMeta?.pvFollowup || '',
      tMove: pvAlg,
      stm: color,
      fen: lastGameData.fen,
    };
  }

  return {
    kMove: navMove?.kibitzer?.pvAlg || '',
    fMove: navPrevMove?.pvFollowup || '',
    tMove: navMove?.pvAlg || '',
    stm: navMove?.color ?? null,
    fen: navFen,
  };
}

function drawArrows() {
  clearArrows();

  const src = arrowSources();
  if (!src) return;

  const thinkingColor = src.stm === 'w' ? arrowColors.white : arrowColors.black;
  const followupColor = src.stm === 'w' ? arrowColors.black : arrowColors.white;

  // PV moves can go stale between when an engine reports them and when we draw
  // (e.g. the piece they move gets captured first), so only draw legal ones. One
  // position is built per draw and rewound between checks.
  let chess: Chess | null = null;
  try {
    chess = new Chess(src.fen);
  } catch {
    return; // unparseable position — nothing can be validated against it
  }

  const isLegal = (uci: string): boolean => {
    try {
      chess!.move({ from: uci.substring(0, 2), to: uci.substring(2, 4), promotion: uci[4] || undefined });
      chess!.undo();
      return true;
    } catch {
      return false;
    }
  };

  // Group arrows by move and blend overlapping colors
  const arrowMap = new Map<string, string[]>();
  const addArrow = (move: string, color: string) => {
    const existing = arrowMap.get(move);
    if (existing) existing.push(color);
    else arrowMap.set(move, [color]);
  };
  if (src.kMove && isLegal(src.kMove)) addArrow(src.kMove, arrowColors.kibitzer);
  if (src.fMove && isLegal(src.fMove)) addArrow(src.fMove, followupColor);
  if (src.tMove && isLegal(src.tMove)) addArrow(src.tMove, thinkingColor);

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
  refreshArrowColors();
  drawArrows();
}

// The function pieceTheme only affects future renders, so rewrite the pieces that
// are already on the boards in place. No board recreation (keeps resize refs valid).
function handlePiecesChange({ set }: { set: string }) {
  applyPieceSet(set as PieceSetId, BOARD_SELECTORS);
}

function highlightSquares(lastMove: { from: string; to: string } | null) {
  $('#board .highlight').removeClass('highlight');
  if (lastMove) {
    $(`#board [data-square="${lastMove.from}"]`).addClass('highlight');
    $(`#board [data-square="${lastMove.to}"]`).addClass('highlight');
  }
}

function getPvFenAtIndex(navIndex: number): { white: string; black: string } {
  if (!navPrevMove) return { white: EMPTY_FEN, black: EMPTY_FEN };

  const moves = lastGameData!.moves || [];
  const movedColor = colorName(navPrevMove.color);
  const otherColor = colorName(navPrevMove.color === 'w' ? 'b' : 'w');
  const halfIdx = navIndex - 1;

  return {
    [movedColor]: navPrevMove.pvFen || EMPTY_FEN,
    [otherColor]: halfIdx > 0 ? moves[halfIdx - 1].pvFen || EMPTY_FEN : EMPTY_FEN,
  } as { white: string; black: string };
}

function setNavMoves(index: number) {
  const moves = lastGameData?.moves ?? [];
  navPrevMove = index > 0 && index <= moves.length ? moves[index - 1] : null;
  navMove = index > 0 && index < moves.length ? moves[index] : null;
}

function handleNavPosition({ fen, isLive, lastMove, index }: NavPosition) {
  const wasLive = live;
  live = isLive;
  navFen = fen;
  board!.position(fen);
  highlightSquares(lastMove);

  if (isLive) {
    navMove = null;
    navPrevMove = null;
    if (!wasLive && lastGameData) updatePvBoards(getLivePvFens(lastGameData));
  } else {
    setNavMoves(index);
    updatePvBoards(getPvFenAtIndex(index));
  }

  drawArrows();
}

export function init() {
  refreshArrowColors();

  // Initialize main board. pieceTheme is a function so chessboardjs picks up the
  // active piece set on every (re)render; handlePiecesChange covers pieces already
  // on the board when the set changes.
  const pieceTheme = (piece: string) => pieceSrc(getPieceSet(), piece);
  board = Chessboard('board', { pieceTheme, showNotation: true });

  // Initialize arrow canvas
  clearArrows();
  sizeArrowBoard();

  // Initialize PV boards
  const pvBoardSettings = {
    pieceTheme,
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
  on('pieces:change', handlePiecesChange);
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

  sizeArrowBoard();
  drawArrows();
}
