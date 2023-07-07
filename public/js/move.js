import $ from 'jquery';

function highlightSq(sq) {
  $('#board').find(`[data-square=${sq}]`).addClass('highlight');
}

function unhightlightAll() {
  $('#board').find(`[data-square]`).removeClass('highlight');
}

function highlightMove(move) {
  if (!move) return;

  highlightSq(move.to);
  highlightSq(move.from);
}

export function updateLastMoves(data) {
  const { game } = data;

  unhightlightAll();
  highlightMove(game[game.stm == 'w' ? 'black' : 'white'].lastMove);
}
