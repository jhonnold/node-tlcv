// public/js/components/results/index.ts
import $ from 'jquery';
import type { H2HCell, StandingsRow } from '../../../../shared/types';
import { on } from '../../events/index';
import { apiBase } from '../../utils/url';
import { deriveRecords, detectGauntlet } from './derive';
import type { EngineRecord, GauntletGroup, Penta } from './derive';

type WLD = { wins: number; draws: number; losses: number };

// Glyphs by pentanomial bucket index: 0=−− 1=− 2== 3=+ 4=++.
const PENTA_GLYPHS = ['−−', '−', '=', '+', '++'];

function fmtPts(points: number): string {
  return points % 1 === 0 ? `${points}.0` : `${points}`;
}

function fmtScore(games: number, scorePct: number): string {
  return games === 0 ? '–' : `${scorePct.toFixed(1)}%`;
}

// Pentanomial pair distribution as five colored counts, green→red left→right
// (++ + = − −−). Exact glyph breakdown + W-L-D in the tooltip.
function pentaRecord(penta: Penta, wld?: WLD): JQuery<HTMLElement> {
  const $wrap = $('<span>').addClass('penta-record');
  for (let i = 4; i >= 0; i--) {
    $('<span>')
      .addClass(`penta-num penta-${i}`)
      .toggleClass('is-zero', penta[i] === 0)
      .text(penta[i])
      .appendTo($wrap);
  }

  const total = penta.reduce((a, b) => a + b, 0);
  const breakdown = [4, 3, 2, 1, 0].map((i) => `${PENTA_GLYPHS[i]}${penta[i]}`).join('  ');
  let title = `${breakdown} · ${total} pair${total === 1 ? '' : 's'}`;
  if (wld) title += ` · W-L-D ${wld.wins}-${wld.losses}-${wld.draws}`;
  $wrap.attr('title', title).attr('aria-label', title);
  return $wrap;
}

function renderH2HCell(cell: H2HCell): JQuery<HTMLElement> {
  const $td = $('<td>').addClass('results-h2h-cell');
  if (cell.results === '**') return $td.addClass('h2h-self');
  if (!cell.results || cell.results === '.') return $td.addClass('h2h-empty').text('·');
  return $td.text(cell.results);
}

// Round-robin / non-gauntlet: the enhanced crosstable matrix.
function renderMatrix(records: EngineRecord[], standings: StandingsRow[]): JQuery<HTMLElement> {
  const $wrapper = $('<div>').addClass('results-table-wrapper');
  const $table = $('<table>').addClass('results-table');

  const $thead = $('<thead>');
  const $hr = $('<tr>');
  $hr.append($('<th>').addClass('results-col-rank').text('#'));
  $hr.append($('<th>').addClass('results-col-name').text('Engine'));
  $hr.append($('<th>').addClass('results-col-games').text('G'));
  $hr.append($('<th>').addClass('results-col-record').text('Record'));
  $hr.append($('<th>').addClass('results-col-points').text('Pts'));
  $hr.append($('<th>').addClass('results-col-score').text('Score'));
  records.forEach((r) => $hr.append($('<th>').addClass('results-col-h2h').text(r.rank)));
  $thead.append($hr);
  $table.append($thead);

  const $tbody = $('<tbody>');
  records.forEach((rec, i) => {
    const row = standings[i];
    const $tr = $('<tr>');
    $tr.append($('<td>').addClass('results-rank').text(rec.rank));
    $tr.append($('<td>').addClass('results-name').attr('title', rec.name).text(rec.name));
    $tr.append($('<td>').addClass('results-games').text(rec.games));
    $tr.append($('<td>').addClass('results-record').append(pentaRecord(rec.penta, rec)));
    $tr.append($('<td>').addClass('results-points').text(fmtPts(rec.points)));
    $tr.append($('<td>').addClass('results-score').text(fmtScore(rec.games, rec.scorePct)));
    row.h2h.forEach((cell) => $tr.append(renderH2HCell(cell)));
    $tbody.append($tr);
  });

  $table.append($tbody);
  $wrapper.append($table);
  return $wrapper;
}

// Gauntlet: the gauntlet engine as the top row, then its record vs each opponent.
function renderGauntletGroup(group: GauntletGroup): JQuery<HTMLElement> {
  const $group = $('<div>').addClass('results-gauntlet-group');
  const eng = group.engine;

  const $table = $('<table>').addClass('results-table');
  const $thead = $('<thead>');
  const $hr = $('<tr>');
  $hr.append($('<th>').addClass('results-col-name').text('Engine'));
  $hr.append($('<th>').addClass('results-col-games').text('Pairs'));
  $hr.append($('<th>').addClass('results-col-record').text('Record'));
  $hr.append($('<th>').addClass('results-col-points').text('Pts'));
  $hr.append($('<th>').addClass('results-col-score').text('Score'));
  $thead.append($hr);
  $table.append($thead);

  const $tbody = $('<tbody>');

  const engPairs = eng.penta.reduce((a, b) => a + b, 0);
  const $engRow = $('<tr>').addClass('results-engine-row');
  $engRow.append($('<td>').addClass('results-name').attr('title', eng.name).text(eng.name));
  $engRow.append($('<td>').addClass('results-games').text(engPairs));
  $engRow.append($('<td>').addClass('results-record').append(pentaRecord(eng.penta, eng)));
  $engRow.append($('<td>').addClass('results-points').text(fmtPts(eng.points)));
  $engRow.append($('<td>').addClass('results-score').text(fmtScore(eng.games, eng.scorePct)));
  $tbody.append($engRow);

  group.opponents.forEach((o) => {
    const pairs = o.penta.reduce((a, b) => a + b, 0);
    const $tr = $('<tr>');
    $tr.append($('<td>').addClass('results-name').attr('title', o.opponentName).text(o.opponentName));
    $tr.append($('<td>').addClass('results-games').text(pairs));
    $tr.append($('<td>').addClass('results-record').append(pentaRecord(o.penta, o)));
    $tr.append($('<td>').addClass('results-points').text(fmtPts(o.points)));
    $tr.append($('<td>').addClass('results-score').text(fmtScore(o.games, o.scorePct)));
    $tbody.append($tr);
  });

  $table.append($tbody);
  $group.append($table);
  return $group;
}

function fetchAndRender(): void {
  const $container = $('#results-container');
  $container.html('<p class="results-loading">Loading results...</p>');

  $.ajax({
    url: `${apiBase()}/result-table/json`,
    method: 'GET',
    dataType: 'json',
  })
    .done((data: { standings?: StandingsRow[] }) => {
      const standings = data.standings || [];
      $container.empty();

      if (!standings.length) {
        $container.append($('<p>').addClass('results-empty').text('No standings data available.'));
        return;
      }

      const records = deriveRecords(standings);
      const analysis = detectGauntlet(standings, records);

      if (analysis.isGauntlet) {
        analysis.groups.forEach((g) => $container.append(renderGauntletGroup(g)));
      } else {
        $container.append(renderMatrix(records, standings));
      }
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
