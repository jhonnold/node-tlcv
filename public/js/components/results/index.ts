// public/js/components/results/index.js
import $ from 'jquery';
import type { H2HCell, StandingsRow } from '../../../../shared/types';
import { on } from '../../events/index';
import { getPort } from '../../utils/url';

function renderH2HCell(cell: H2HCell, isSelf: boolean) {
  const $td = $('<td>').addClass('results-h2h-cell');

  if (isSelf) {
    return $td.addClass('h2h-self');
  }

  if (!cell.results || cell.results === '.') {
    return $td.addClass('h2h-empty').text('\u00b7');
  }

  return $td.text(cell.results);
}

function renderStandings(standings: StandingsRow[]) {
  if (!standings.length) {
    return $('<p>').addClass('results-empty').text('No standings data available.');
  }

  const $wrapper = $('<div>').addClass('results-table-wrapper');
  const $table = $('<table>').addClass('results-table');

  const $thead = $('<thead>');
  const $hr = $('<tr>');
  $hr.append($('<th>').addClass('results-col-rank').text('#'));
  $hr.append($('<th>').addClass('results-col-name').text('Engine'));
  $hr.append($('<th>').addClass('results-col-games').text('G'));
  $hr.append($('<th>').addClass('results-col-points').text('Pts'));

  standings.forEach((row: StandingsRow) => {
    $hr.append($('<th>').addClass('results-col-h2h').text(row.rank));
  });

  $thead.append($hr);
  $table.append($thead);

  const $tbody = $('<tbody>');
  standings.forEach((row: StandingsRow) => {
    const $tr = $('<tr>');
    $tr.append($('<td>').addClass('results-rank').text(row.rank));
    $tr.append($('<td>').addClass('results-name').attr('title', row.name).text(row.name));
    $tr.append($('<td>').addClass('results-games').text(row.games));
    $tr.append(
      $('<td>')
        .addClass('results-points')
        .text(row.points % 1 === 0 ? `${row.points}.0` : row.points),
    );

    row.h2h.forEach((cell: H2HCell) => {
      $tr.append(renderH2HCell(cell, cell.results === '**'));
    });

    $tbody.append($tr);
  });

  $table.append($tbody);
  $wrapper.append($table);
  return $wrapper;
}

function fetchAndRender() {
  const $container = $('#results-container');
  $container.html('<p class="results-loading">Loading results...</p>');

  $.ajax({
    url: `/${getPort()}/result-table/json`,
    method: 'GET',
    dataType: 'json',
  })
    .done((data) => {
      $container.empty();

      $container.append(renderStandings(data.standings || []));
    })
    .fail(() => {
      $container.html('<p class="results-error">No results available.</p>');
    });
}

export function init() {
  on('tab:change', ({ tab }) => {
    if (tab === 'results') fetchAndRender();
  });
}
