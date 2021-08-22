import $ from 'jquery';

function highlightSq(sq) {
  $('#board').find(`.square-${sq}`).addClass('highlight');
}

function unhighlightSq(sq) {
  $('#board').find(`.square-${sq}`).removeClass('highlight');
}

function highlightMove(move) {
  if (!move) return;

  highlightSq(move.to);
  highlightSq(move.from);
}

function unhighlightMove(move) {
  if (!move) return;

  unhighlightSq(move.to);
  unhighlightSq(move.from);
}

export function updateLastMoves(data) {
  const { game } = data;

  if (game.stm == 'w') {
    unhighlightMove(game.white.lastMove);
    highlightMove(game.black.lastMove);
  } else {
    unhighlightMove(game.black.lastMove);
    highlightMove(game.white.lastMove);
  }
}
