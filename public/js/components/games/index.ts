import $ from 'jquery';
import type { GameRecord, StoredGameMeta } from '../../../../shared/types';
import { on, emit } from '../../events/index';
import { apiBase, isArchive } from '../../utils/url';
import { getJson, loadPanel } from '../../utils/http';

const DOWNLOAD_ICON =
  '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>';

const PLAY_ICON =
  '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="5,3 19,12 5,21"></polygon></svg>';

const FILTER_DEBOUNCE_MS = 150;

let allGames: GameRecord[] = [];

function normalizeForMatch(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

// Fuzzy match: case-insensitive, tolerant of gaps/typos (subsequence) and of
// out-of-order query characters (all query chars present in the name). `q` is
// already normalized — it is loop-invariant across the whole games list.
function fuzzyMatches(q: string, name: string): boolean {
  const n = normalizeForMatch(name);
  if (!q) return true;
  if (n.length < q.length) return false;

  let qi = 0;
  for (let ni = 0; ni < n.length && qi < q.length; ni++) {
    if (n.charCodeAt(ni) === q.charCodeAt(qi)) qi++;
  }
  if (qi === q.length) return true;

  const remaining = new Map<string, number>();
  for (const c of n) remaining.set(c, (remaining.get(c) ?? 0) + 1);
  for (const c of q) {
    const left = (remaining.get(c) ?? 0) - 1;
    if (left < 0) return false;
    remaining.set(c, left);
  }
  return true;
}

function isDecisive(result: string): boolean {
  return result === '1-0' || result === '0-1';
}

function filteredGames(): GameRecord[] {
  const query = normalizeForMatch(String($('#games-filter-input').val() ?? ''));
  const decisiveOnly = $('#games-filter-decisive').is(':checked');

  return allGames.filter((g) => {
    if (query && !(fuzzyMatches(query, g.white) || fuzzyMatches(query, g.black))) return false;
    if (decisiveOnly && !isDecisive(g.result)) return false;
    return true;
  });
}

function renderGames(games: GameRecord[]) {
  if (!games.length) {
    return $('<p>')
      .addClass('games-empty')
      .text(allGames.length ? 'No games match your filter.' : 'No games data available.');
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
      // Click handling is delegated on #games-container, so the button only needs
      // to carry its game number — no per-row closure to allocate.
      $replayCell.append(
        $('<button>').addClass('games-replay-btn').attr('data-game-number', game.gameNumber).html(PLAY_ICON),
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
  getJson<StoredGameMeta>(`${apiBase()}/games/${gameNumber}/meta`)
    .done((data) => {
      emit('game:replay', data);
      emit('tab:change', { tab: 'moves' });
    })
    .fail(() => {
      console.error(`Failed to load metadata for game ${gameNumber}`);
    });
}

function applyFilter() {
  $('#games-container').empty().append(renderGames(filteredGames()));
}

function fetchAndRender(onData?: (data: GameRecord[]) => void) {
  loadPanel<GameRecord[]>(
    $('#games-container'),
    `${apiBase()}/games/json`,
    'games',
    (data) => {
      allGames = data;
      return renderGames(filteredGames());
    },
    onData,
  );
}

// Archive pages have no live feed, so open them on the most recent finished game
// (highest game number with a saved meta sidecar) to avoid landing on a blank board.
function loadLatest(fetchData: GameRecord[]) {
  const latest = fetchData
    .filter((g) => g.metaUrl)
    .reduce<GameRecord | null>((best, g) => (!best || g.gameNumber > best.gameNumber ? g : best), null);
  if (latest) loadReplay(latest.gameNumber);
}

export function init() {
  // Typing re-runs the fuzzy match over every game and rebuilds the table, so wait
  // for a pause rather than doing it per keystroke.
  let filterHandle: ReturnType<typeof setTimeout> | undefined;
  $('#games-filter-input').on('input', () => {
    if (filterHandle) clearTimeout(filterHandle);
    filterHandle = setTimeout(applyFilter, FILTER_DEBOUNCE_MS);
  });
  $('#games-filter-decisive').on('change', applyFilter);

  $('#games-container').on('click', '.games-replay-btn', function handleReplayClick() {
    loadReplay(Number($(this).attr('data-game-number')));
  });

  on('tab:change', ({ tab }) => {
    if (tab === 'games') fetchAndRender();
  });

  if (isArchive()) {
    fetchAndRender(loadLatest);
  }
}
