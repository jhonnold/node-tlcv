// public/js/components/navigation/index.js
import { Chess } from 'chess.js';
import $ from 'jquery';
import type { MoveMetaData } from '../../../../shared/types';
import { on, emit } from '../../events/index';
import type { GameEventData } from '../../events/index';
import { getActiveTab } from '../tabs/index';
import { isReplayMode } from '../replay/index';

// State
// navIndex ranges from 0 to sanMoves.length inclusive:
//   0 = starting position (before any moves)
//   k (1..sanMoves.length) = position after the k-th half-move = fens[k-1]
//   sanMoves.length = live position
let sanMoves: string[] = []; // SAN strings from server
let startFen: string | null = null; // starting FEN (null = standard)
let fens: string[] = []; // computed FENs: fens[i] = position AFTER sanMoves[i]
let lastMoves: { from: string; to: string }[] = []; // { from, to } for each half-move
let navIndex = 0;
let liveFen = 'start';
let dirty = false;

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

function isLive() {
  return navIndex === sanMoves.length;
}

function rebuildFens() {
  const chess = startFen ? new Chess(startFen) : new Chess();
  fens = [];
  lastMoves = [];

  sanMoves.every((san) => {
    try {
      const move = chess.move(san);
      fens.push(chess.fen());
      lastMoves.push({ from: move.from, to: move.to });
      return true;
    } catch {
      return false;
    }
  });
}

function getFen(idx: number) {
  if (idx === 0) return startFen || START_FEN;
  if (idx > 0 && idx <= fens.length) return fens[idx - 1];
  return liveFen;
}

function getLastMove(idx: number) {
  if (idx === 0) return null;
  if (idx > 0 && idx <= lastMoves.length) return lastMoves[idx - 1];
  return null;
}

function emitPosition() {
  const fen = getFen(navIndex);
  emit('nav:position', { fen, isLive: isLive(), index: navIndex, lastMove: getLastMove(navIndex) });
  $('#fen').text(fen);
}

function getStartMoveNumber() {
  if (!startFen) return 1;
  const parts = startFen.split(' ');
  return parseInt(parts[5], 10) || 1;
}

function getStartTurn() {
  if (!startFen) return 'w';
  const parts = startFen.split(' ');
  return parts[1] || 'w';
}

function isActiveMove(moveIdx: number) {
  return navIndex === moveIdx + 1;
}

function scrollActiveIntoView() {
  const $list = $('#move-list');
  if (!$list[0]) return;

  const $active = $list.find('.move-entry.active');
  if ($active.length) {
    const listEl = $list[0];
    const activeRow = $active[0].closest('tr')!;
    const listRect = listEl.getBoundingClientRect();
    const rowRect = activeRow.getBoundingClientRect();
    const activeTop = rowRect.top - listRect.top + listEl.scrollTop;
    const activeHeight = rowRect.height;
    const listHeight = listEl.clientHeight;

    if (activeTop < listEl.scrollTop || activeTop + activeHeight > listEl.scrollTop + listHeight) {
      listEl.scrollTop = activeTop - listHeight / 2 + activeHeight / 2;
    }
  } else if (isLive()) {
    $list[0].scrollTop = $list[0].scrollHeight;
  }
}

function updateActiveHighlight() {
  const $list = $('#move-list');
  $list.find('.move-entry.active').removeClass('active');
  if (navIndex > 0) {
    $list.find(`.move-entry[data-idx="${navIndex - 1}"]`).addClass('active');
  }
  scrollActiveIntoView();
}

function renderMoveList() {
  const $list = $('#move-list');
  $list.empty();

  const startMove = getStartMoveNumber();
  const startTurn = getStartTurn();
  const blackStarts = startTurn === 'b';

  const $table = $('<table>').addClass('move-table');

  const $thead = $('<thead>');
  const $headerRow = $('<tr>');
  $headerRow.append($('<th>').addClass('move-col-num').text('#'));
  $headerRow.append($('<th>').addClass('move-col-white').text('White'));
  $headerRow.append($('<th>').addClass('move-col-black').text('Black'));
  $thead.append($headerRow);
  $table.append($thead);

  const $tbody = $('<tbody>');

  let moveIdx = 0;

  // If black moves first, insert a placeholder for the missing white move
  if (blackStarts && sanMoves.length > 0) {
    const $tr = $('<tr>');
    $tr.append($('<td>').addClass('move-num').text(`${startMove}.`));
    $tr.append($('<td>').addClass('move-placeholder').text('...'));

    const $bMove = $('<td>').addClass('move-entry').attr('data-idx', 0).text(sanMoves[0]);
    if (isActiveMove(0)) $bMove.addClass('active');
    $tr.append($bMove);
    $tbody.append($tr);
    moveIdx = 1;
  }

  const halfMoveOffset = blackStarts ? 1 : 0;

  while (moveIdx < sanMoves.length) {
    const globalHalfMove = moveIdx + halfMoveOffset;
    const moveNum = startMove + Math.floor(globalHalfMove / 2);
    const isWhiteMove = globalHalfMove % 2 === 0;

    if (isWhiteMove) {
      const $tr = $('<tr>');
      $tr.append($('<td>').addClass('move-num').text(`${moveNum}.`));

      const $wMove = $('<td>').addClass('move-entry').attr('data-idx', moveIdx).text(sanMoves[moveIdx]);
      if (isActiveMove(moveIdx)) $wMove.addClass('active');
      $tr.append($wMove);

      if (moveIdx + 1 < sanMoves.length) {
        const $bMove = $('<td>')
          .addClass('move-entry')
          .attr('data-idx', moveIdx + 1)
          .text(sanMoves[moveIdx + 1]);
        if (isActiveMove(moveIdx + 1)) $bMove.addClass('active');
        $tr.append($bMove);
        moveIdx += 2;
      } else {
        $tr.append($('<td>'));
        moveIdx += 1;
      }

      $tbody.append($tr);
    } else {
      moveIdx += 1;
    }
  }

  $table.append($tbody);
  $list.append($table);

  scrollActiveIntoView();
}

export function getNavIndex() {
  return navIndex;
}

export function goTo(idx: number) {
  navIndex = Math.max(0, Math.min(idx, sanMoves.length));
  updateActiveHighlight();
  emitPosition();
}

function handleGameState(data: GameEventData) {
  const { game } = data;
  sanMoves = (game.moves || []).map((m: MoveMetaData) => m.move);
  startFen = game.startFen || null;
  liveFen = game.fen;
  rebuildFens();
  navIndex = isReplayMode() ? 0 : sanMoves.length;
  renderMoveList();
  emitPosition();
}

function handleGameUpdate(data: GameEventData) {
  if (isReplayMode()) return;

  const { game } = data;
  const wasLive = isLive();
  const prevLength = sanMoves.length;

  sanMoves = (game.moves || []).map((m: MoveMetaData) => m.move);
  startFen = game.startFen || null;
  liveFen = game.fen;

  const movesChanged = sanMoves.length !== prevLength;

  if (wasLive) {
    navIndex = sanMoves.length;
  }

  if (movesChanged) {
    rebuildFens();

    if (getActiveTab() === 'moves') {
      renderMoveList();
    } else {
      dirty = true;
    }
  }

  if (wasLive) {
    emitPosition();
  }
}

export function init() {
  on('game:state', handleGameState);
  on('game:update', handleGameUpdate);

  $('#move-list').on('click', '.move-entry', function handleMoveClick() {
    const idx = parseInt($(this).attr('data-idx')!, 10);
    goTo(idx + 1);
  });

  on('tab:change', ({ tab }) => {
    if (tab === 'moves') {
      if (dirty) {
        renderMoveList();
        dirty = false;
      } else {
        scrollActiveIntoView();
      }
    }
  });

  // Keyboard navigation - active unless an editable element is focused
  $(document).on('keydown', (e) => {
    const el = document.activeElement as HTMLElement | null;
    if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;

    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      goTo(navIndex - 1);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      goTo(navIndex + 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      goTo(0);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      goTo(sanMoves.length);
    }
  });
}

export default { init };
