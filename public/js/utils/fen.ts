import $ from 'jquery';

export const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

/** Board-shaped placeholder for "no position to show" (PV boards, replay stubs). */
export const EMPTY_FEN = '8/8/8/8/8/8/8/8';

export function updateFenDisplay(fen: string) {
  $('#fen').text(fen);
  $('#board-fen').text(fen);
}

export default function copyFen(fen: string) {
  const text = fen || $('#fen').text();
  const temp = $('<input>');
  $('body').append(temp);

  temp.val(text).trigger('select');
  document.execCommand('copy');

  temp.remove();
}
