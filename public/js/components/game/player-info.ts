// public/js/components/game/player-info.js
import $ from 'jquery';
import type { SerializedGame, MoveMetaData, SerializedKibitzerLiveData, KibitzerMeta } from '../../../../shared/types';
import { colorName } from '../../../../shared/colors';
import pv, { formatPv } from '../../utils/pv';
import { updateFenDisplay } from '../../utils/fen';

function updateElText(el: JQuery, val: string) {
  const curr = el.text();
  if (curr !== val) el.text(val);
}

const MATE_SCORE_THRESHOLD = 100000;

function formatScore(score: number, color: string) {
  const s = color === 'black' ? score * -1 : score;

  if (s > MATE_SCORE_THRESHOLD) {
    return 'M';
  } else if (s < -MATE_SCORE_THRESHOLD) {
    return '-M';
  } else {
    return s.toFixed(2);
  }
}

function formatNodes(nodes: number) {
  return `${(nodes / 1000000).toFixed(2)}M`;
}

function formatNps(nodes: number, time: number | null) {
  if (!time) return '--';
  return `${(nodes / time / 1000000).toFixed(2)}M`;
}

export function updateLiveInfo(game: SerializedGame, color: 'white' | 'black') {
  const { liveData } = game;

  updateElText($(`#${color}-name`), game[color].name);
  updateElText($(`#${color}-score`), formatScore(liveData.score, color));
  updateElText($(`#${color}-depth`), String(liveData.depth));
  updateElText($(`#${color}-nodes`), formatNodes(liveData.nodes));
  updateElText(
    $(`#${color}-nps`),
    liveData.usedTime ? `${(liveData.nodes / liveData.usedTime / 1000).toFixed(2)}M` : '--',
  );
  $(`#${color}-pv`).html(pv(liveData, color));
}

export function updateHistoricalInfo(color: string, meta: MoveMetaData | null) {
  if (!meta) {
    updateElText($(`#${color}-score`), '--');
    updateElText($(`#${color}-depth`), '--');
    updateElText($(`#${color}-nodes`), '--');
    updateElText($(`#${color}-nps`), '--');
    $(`#${color}-pv`).html('');
  } else {
    updateElText($(`#${color}-score`), meta.score != null ? formatScore(meta.score, color) : '--');
    updateElText($(`#${color}-depth`), meta.depth != null ? String(meta.depth) : '--');
    updateElText($(`#${color}-nodes`), meta.nodes != null ? formatNodes(meta.nodes) : '--');
    updateElText($(`#${color}-nps`), meta.nodes != null ? formatNps(meta.nodes, meta.time) : '--');
    $(`#${color}-pv`).html(formatPv(meta.pv, meta.pvMoveNumber ?? 1, color));
  }
}

export function updateTitle(game: SerializedGame) {
  const title = `${game.white.name} vs ${game.black.name} (${game.site})`;
  const curr = document.title;
  if (curr !== title) document.title = title;
}

export function updateOpening(game: SerializedGame) {
  const text = game.tablebase ? `Tablebase: ${game.tablebase}` : `Opening: ${game.opening}`;
  $('#caption').text(text);
  $('#board-caption').text(text);
}

export function updateSpectators(spectators: string[]) {
  $('#spectator-box').children().remove();
  spectators.sort().forEach((name: string) => {
    $('#spectator-box').append($('<li>').append($('<p>').text(name)));
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

function formatKibitzerScore(score: number) {
  if (score > MATE_SCORE_THRESHOLD) return 'M';
  if (score < -MATE_SCORE_THRESHOLD) return '-M';
  return score >= 0 ? `+${score.toFixed(2)}` : score.toFixed(2);
}

export function updateKibitzerBar(liveData: SerializedKibitzerLiveData) {
  updateElText($('#kibitzer-name'), liveData.name);
  updateElText($('#kibitzer-score'), formatKibitzerScore(liveData.score));
  $('#kibitzer-score').attr('title', `Depth: ${liveData.depth} | Nodes: ${formatNodes(liveData.nodes)}`);
  const pvHtml = formatPv(liveData.pv, liveData.pvMoveNumber, colorName(liveData.stm));
  $('#kibitzer-pv').html(pvHtml);
  $('#kibitzer-bar').removeClass('kibitzer-inactive').prop('hidden', false);
}

export function updateKibitzerBarFromMeta(meta: KibitzerMeta) {
  updateElText($('#kibitzer-name'), 'Kibitzer');
  updateElText($('#kibitzer-score'), formatKibitzerScore(meta.score));
  $('#kibitzer-score').attr('title', `Depth: ${meta.depth} | Nodes: ${formatNodes(meta.nodes)}`);
  const pvHtml = formatPv(meta.pv, meta.pvMoveNumber ?? 1, colorName(meta.stm));
  $('#kibitzer-pv').html(pvHtml);
  $('#kibitzer-bar').removeClass('kibitzer-inactive').prop('hidden', false);
}

export function showKibitzerPlaceholder(message: string) {
  $('#kibitzer-name').text(message);
  $('#kibitzer-score').text('').removeAttr('title');
  $('#kibitzer-pv').html('');
  $('#kibitzer-bar').addClass('kibitzer-inactive').prop('hidden', false);
}
