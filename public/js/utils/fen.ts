import $ from 'jquery';

export default function copyFen(fen) {
  const text = fen || $('#fen').text();
  const temp = $('<input>');
  $('body').append(temp);

  temp.val(text).trigger('select');
  document.execCommand('copy');

  temp.remove();
}
