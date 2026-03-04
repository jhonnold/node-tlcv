import $ from 'jquery';

export default function copyFen() {
  const temp = $('<input>');
  $('body').append(temp);

  temp.val($('#fen').text()).trigger('select');
  document.execCommand('copy');

  temp.remove();
}
