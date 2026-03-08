import $ from 'jquery';

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
