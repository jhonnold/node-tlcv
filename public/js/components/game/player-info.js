// public/js/components/game/player-info.js
import $ from '../../$/index.js';
import pv, { formatPv } from '../../utils/pv.js';

function updateElText(el, val) {
  const curr = el.text();
  if (curr !== val) el.text(val);
}

function formatScore(score, color) {
  let s = color === 'black' ? score * -1 : score;

  if (s > 100000) {
    s = 'M';
  } else if (s < -100000) {
    s = '-M';
  } else {
    s = s.toFixed(2);
  }

  return String(s);
}

function formatNodes(nodes) {
  return `${(nodes / 1000000).toFixed(2)}M`;
}

function formatNps(nodes, time) {
  if (!time) return '--';
  return `${(nodes / time / 1000000).toFixed(2)}M`;
}

export function updateInfo(game, color) {
  const player = game[color];

  updateElText($(`#${color}-name`), player.name);
  updateElText($(`#${color}-score`), formatScore(player.score, color));
  updateElText($(`#${color}-depth`), player.depth);
  updateElText($(`#${color}-nodes`), formatNodes(player.nodes));
  updateElText($(`#${color}-nps`), `${(player.nodes / player.usedTime / 1000).toFixed(2)}M`);
  $(`#${color}-pv`).html(pv(game, color));
}

export function updateHistoricalInfo(color, meta) {
  if (!meta) {
    updateElText($(`#${color}-score`), '--');
    updateElText($(`#${color}-depth`), '--');
    updateElText($(`#${color}-nodes`), '--');
    updateElText($(`#${color}-nps`), '--');
    $(`#${color}-pv`).html('');
  } else {
    updateElText($(`#${color}-score`), formatScore(meta.score, color));
    updateElText($(`#${color}-depth`), String(meta.depth));
    updateElText($(`#${color}-nodes`), formatNodes(meta.nodes));
    updateElText($(`#${color}-nps`), formatNps(meta.nodes, meta.time));
    $(`#${color}-pv`).html(formatPv(meta.pv, meta.pvMoveNumber, color));
  }
}

export function updateTitle(game) {
  const title = `${game.white.name} vs ${game.black.name} (${game.site})`;
  const curr = document.title;
  if (curr !== title) document.title = title;
}

export function updateOpening(game) {
  if (game.tablebase) {
    $('#caption').text(`Tablebase: ${game.tablebase}`);
  } else {
    $('#caption').text(`Opening: ${game.opening}`);
  }
}

export function updateSpectators(spectators) {
  $('#spectator-box').children().remove();
  spectators.sort().forEach((name) => {
    $('#spectator-box').append($('<li>').append($('<p>').text(name)));
  });
}

export function updateMenu(menu) {
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

export function update(game) {
  updateTitle(game);
  updateInfo(game, 'white');
  updateInfo(game, 'black');
  updateOpening(game);
  $('#fen').text(game.fen);
}

export default {
  updateInfo,
  updateHistoricalInfo,
  updateTitle,
  updateOpening,
  updateSpectators,
  updateMenu,
  update,
};
