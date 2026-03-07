import $ from 'jquery';
import type { GameRecord } from '../../../../shared/types';
import { on } from '../../events/index';

function getPort() {
  return +window.location.pathname.replace(/\//g, '');
}

const LINK_ICON =
  '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="7" y1="17" x2="17" y2="7"></line><polyline points="7 7 17 7 17 17"></polyline></svg>';

function renderGames(games: GameRecord[]) {
  if (!games.length) {
    return $('<p>').addClass('games-empty').text('No games data available.');
  }

  const $table = $('<table>').addClass('games-table');

  const $thead = $('<thead>');
  const $hr = $('<tr>');
  $hr.append($('<th>').addClass('games-col-num').text('#'));
  $hr.append($('<th>').addClass('games-col-white').text('White'));
  $hr.append($('<th>').addClass('games-col-black').text('Black'));
  $hr.append($('<th>').addClass('games-col-result').text('Result'));
  $hr.append($('<th>').addClass('games-col-pgn').text('PGN'));
  $thead.append($hr);
  $table.append($thead);

  const $tbody = $('<tbody>');
  games.forEach((game: GameRecord) => {
    const $tr = $('<tr>');
    $tr.append($('<td>').addClass('games-num').text(game.gameNumber));
    $tr.append($('<td>').addClass('games-name').attr('title', game.white).text(game.white));
    $tr.append($('<td>').addClass('games-name').attr('title', game.black).text(game.black));
    $tr.append($('<td>').addClass('games-result').text(game.result));
    const $pgnCell = $('<td>').addClass('games-pgn');
    if (game.pgnUrl) {
      $pgnCell.append(
        $('<a>').addClass('games-pgn-link').attr('href', game.pgnUrl).attr('target', '_blank').html(LINK_ICON),
      );
    }
    $tr.append($pgnCell);
    $tbody.append($tr);
  });

  $table.append($tbody);
  return $table;
}

function fetchAndRender() {
  const $container = $('#games-container');
  $container.html('<p class="games-loading">Loading games...</p>');

  $.ajax({
    url: `/${getPort()}/games/json`,
    method: 'GET',
    dataType: 'json',
  })
    .done((data: GameRecord[]) => {
      $container.empty();
      $container.append(renderGames(data));
    })
    .fail(() => {
      $container.html('<p class="games-error">No games available.</p>');
    });
}

export function init() {
  on('tab:change', ({ tab }) => {
    if (tab === 'games') fetchAndRender();
  });
}

export default { init };
