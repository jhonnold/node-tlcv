// public/js/components/game/player-info.js
import $ from 'jquery';
import type {
  SerializedGame,
  MoveMetaData,
  SerializedKibitzerLiveData,
  KibitzerMeta,
  ColorCode,
} from '../../../../shared/types';
import { colorName } from '../../../../shared/colors';
import { formatPv } from '../../utils/pv';
import { updateFenDisplay } from '../../utils/fen';
import { formatScore, formatSignedScore, formatNodes, formatNps } from '../../utils/format';

function updateElText(el: JQuery, val: string) {
  const curr = el.text();
  if (curr !== val) el.text(val);
}

// `game:update` fires up to ~10x/second, but most of these values only change when
// a move lands. Re-parsing identical PV markup is the most expensive of the writes,
// so guard it the same way updateElText guards text.
function updateElHtml(el: JQuery, val: string) {
  if (el.html() !== val) el.html(val);
}

export function updateLiveInfo(game: SerializedGame, color: 'white' | 'black') {
  const { liveData } = game;

  updateElText($(`#${color}-name`), game[color].name);
  updateElText($(`#${color}-score`), formatScore(liveData.score, color));
  updateElText($(`#${color}-depth`), String(liveData.depth));
  updateElText($(`#${color}-nodes`), formatNodes(liveData.nodes));
  // usedTime is milliseconds; formatNps takes seconds.
  updateElText($(`#${color}-nps`), formatNps(liveData.nodes, liveData.usedTime / 1000));
  updateElHtml($(`#${color}-pv`), formatPv(liveData.pv, liveData.pvMoveNumber, color));
}

export function updateHistoricalInfo(color: string, meta: MoveMetaData | null) {
  if (!meta) {
    updateElText($(`#${color}-score`), '--');
    updateElText($(`#${color}-depth`), '--');
    updateElText($(`#${color}-nodes`), '--');
    updateElText($(`#${color}-nps`), '--');
    updateElHtml($(`#${color}-pv`), '');
  } else {
    updateElText($(`#${color}-score`), meta.score != null ? formatScore(meta.score, color) : '--');
    updateElText($(`#${color}-depth`), meta.depth != null ? String(meta.depth) : '--');
    updateElText($(`#${color}-nodes`), meta.nodes != null ? formatNodes(meta.nodes) : '--');
    updateElText($(`#${color}-nps`), meta.nodes != null ? formatNps(meta.nodes, meta.time) : '--');
    updateElHtml($(`#${color}-pv`), formatPv(meta.pv, meta.pvMoveNumber ?? 1, color));
  }
}

export function updateTitle(game: SerializedGame) {
  const title = `${game.white.name} vs ${game.black.name} (${game.site})`;
  const curr = document.title;
  if (curr !== title) document.title = title;
}

export function updateOpening(game: SerializedGame) {
  const text = game.tablebase ? `Tablebase: ${game.tablebase}` : `Opening: ${game.opening}`;
  updateElText($('#caption'), text);
  updateElText($('#board-caption'), text);
}

// The delta merge only replaces `spectators` when the server actually sends a new
// list, so an unchanged reference means an unchanged room — skip the rebuild.
let lastSpectators: string[] | null = null;

export function updateSpectators(spectators: string[]) {
  if (spectators === lastSpectators) return;
  lastSpectators = spectators;

  const $box = $('#spectator-box');
  $box.children().remove();
  [...spectators].sort().forEach((name: string) => {
    $box.append($('<li>').append($('<p>').text(name)));
  });
}

export function updateMenu(menu: { [key: string]: string }) {
  const $schedule = $('#schedule');
  const $eventThread = $('#event-thread');

  if (menu.schedule) {
    $schedule.attr('href', menu.schedule).prop('hidden', false);
  } else {
    $schedule.prop('hidden', true);
  }

  if (menu.even) {
    $eventThread.attr('href', menu.even).prop('hidden', false);
  } else {
    $eventThread.prop('hidden', true);
  }
}

export function update(game: SerializedGame) {
  updateTitle(game);
  updateOpening(game);
  updateFenDisplay(game.fen);

  const liveColor = colorName(game.liveData.color);
  const otherColor = colorName(game.liveData.color === 'w' ? 'b' : 'w');

  updateLiveInfo(game, liveColor);

  updateElText($(`#${otherColor}-name`), game[otherColor].name);
  const moves = game.moves || [];
  const lastMeta = moves.length ? moves[moves.length - 1] : null;
  updateHistoricalInfo(otherColor, lastMeta?.depth != null ? lastMeta : null);
}

type KibitzerView = {
  name: string;
  score: number;
  depth: number;
  nodes: number;
  pv: string[] | null;
  pvMoveNumber: number;
  stm: ColorCode;
};

function renderKibitzer({ name, score, depth, nodes, pv, pvMoveNumber, stm }: KibitzerView) {
  updateElText($('#kibitzer-name'), name);
  updateElText($('#kibitzer-score'), formatSignedScore(score));
  $('#kibitzer-score').attr('title', `Depth: ${depth} | Nodes: ${formatNodes(nodes)}`);
  updateElHtml($('#kibitzer-pv'), formatPv(pv, pvMoveNumber, colorName(stm)));
  $('#kibitzer-bar').removeClass('kibitzer-inactive').prop('hidden', false);
}

export function updateKibitzerBar(liveData: SerializedKibitzerLiveData) {
  renderKibitzer(liveData);
}

export function updateKibitzerBarFromMeta(meta: KibitzerMeta) {
  renderKibitzer({ ...meta, name: 'Kibitzer', pvMoveNumber: meta.pvMoveNumber ?? 1 });
}

export function showKibitzerPlaceholder(message: string) {
  updateElText($('#kibitzer-name'), message);
  $('#kibitzer-score').text('').removeAttr('title');
  updateElHtml($('#kibitzer-pv'), '');
  $('#kibitzer-bar').addClass('kibitzer-inactive').prop('hidden', false);
}
