// public/js/components/game/player-info.js
import $ from '../../$/index.js';
import pv from '../../utils/pv.js';

function updateElText(el, val) {
  const curr = el.text();
  if (curr !== val) el.text(val);
}

export function updateInfo(game, color) {
  let { score } = game[color];
  if (color === 'black') score *= -1;

  if (score > 100000) {
    score = 'M';
  } else if (score < -100000) {
    score = '-M';
  } else {
    score = score.toFixed(2);
  }

  updateElText($(`#${color}-name`), game[color].name);
  updateElText($(`#${color}-score`), score);
  updateElText($(`#${color}-depth`), game[color].depth);
  updateElText($(`#${color}-nodes`), `${(game[color].nodes / 1000000).toFixed(2)}M`);
  updateElText($(`#${color}-nps`), `${(game[color].nodes / game[color].usedTime / 1000).toFixed(2)}M`);
  $(`#${color}-pv`).html(pv(game, color));
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

export default { updateInfo, updateTitle, updateOpening, updateSpectators, updateMenu, update };
