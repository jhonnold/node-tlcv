import $ from 'jquery';
import type { GameRecord, StoredGameMeta } from '../../../../shared/types';
import { on, emit } from '../../events/index';
import { getPort } from '../../utils/url';

const DOWNLOAD_ICON =
  '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>';

const PLAY_ICON =
  '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="5,3 19,12 5,21"></polygon></svg>';

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
  $hr.append($('<th>').addClass('games-col-replay').text('View'));
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
    const $replayCell = $('<td>').addClass('games-replay');
    if (game.metaUrl) {
      $replayCell.append(
        $('<button>')
          .addClass('games-replay-btn')
          .html(PLAY_ICON)
          .on('click', () => loadReplay(game.gameNumber)),
      );
    }
    $tr.append($replayCell);
    const $pgnCell = $('<td>').addClass('games-pgn');
    if (game.pgnUrl) {
      $pgnCell.append(
        $('<a>').addClass('games-pgn-link').attr('href', game.pgnUrl).attr('download', '').html(DOWNLOAD_ICON),
      );
    }
    $tr.append($pgnCell);
    $tbody.append($tr);
  });

  $table.append($tbody);
  return $table;
}

function loadReplay(gameNumber: number) {
  $.ajax({
    url: `/${getPort()}/games/${gameNumber}/meta`,
    method: 'GET',
    dataType: 'json',
  })
    .done((data: StoredGameMeta) => {
      emit('game:replay', data);
      emit('tab:change', { tab: 'moves' });
    })
    .fail(() => {
      // eslint-disable-next-line no-console
      console.error(`Failed to load metadata for game ${gameNumber}`);
    });
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
