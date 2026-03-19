import $ from 'jquery';
import { init as initTheme } from './components/theme/index';

function sortCards(key: string) {
  const $grid = $('.broadcasts-grid');
  if (!$grid.length) return;

  const $cards = $grid.children('.broadcast-card').detach().toArray();

  $cards.sort((a, b) => {
    const aVal = parseFloat($(a).attr(`data-${key}`) || '0');
    const bVal = parseFloat($(b).attr(`data-${key}`) || '0');
    return bVal - aVal;
  });

  $grid.append($cards);
}

$(document).ready(() => {
  initTheme();

  $('.sort-btn').on('click', function () {
    const key = $(this).data('sort') as string;
    $('.sort-btn').removeClass('active');
    $(this).addClass('active');
    sortCards(key);
  });
});
