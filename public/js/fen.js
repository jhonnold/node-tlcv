import $ from 'jquery';

export function copyFen() {
  const temp = $('<input>');
  $('body').append(temp);

  temp.val($('#fen').text()).trigger('select');
  document.execCommand('copy');

  temp.remove();

  $('#fen-tooltip').attr('aria-label', 'Copied!');
  setTimeout(() => $('#fen-tooltip').attr('aria-label', 'Click to copy'), 1000);
}
