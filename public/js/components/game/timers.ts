// public/js/components/game/timers.js
import $ from 'jquery';

const timerIntervals = new Map();

function msToString(ms) {
  const s = Math.floor((ms / 1000) % 60);
  const m = Math.floor(ms / 1000 / 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function updateTimer(time, start, color) {
  const used = new Date().getTime() - start;
  $(`#${color}-time`).html('');
  $(`#${color}-time`).append($('<mark>').text(msToString(Math.max(0, time - used))));
  $(`#${color}-think`).text(msToString(used));
}

function clearTimer(color) {
  clearInterval(timerIntervals.get(color));
  timerIntervals.delete(color);
}

function stopTimer(color) {
  clearTimer(color);
  const mark = $(`#${color}-time`).find('mark');
  if (mark.length) $(`#${color}-time`).text(mark.text());
}

function startTimer(game, color) {
  const time = game[color].clockTime;
  const start = game[color].startTime;

  updateTimer(time, start, color);
  timerIntervals.set(
    color,
    setInterval(() => updateTimer(time, start, color), 1000),
  );
}

function isTimerRunning(color) {
  return timerIntervals.has(color);
}

export function updateTimers(data) {
  const { game } = data;

  if (game.stm === 'w') {
    if (!isTimerRunning('white')) {
      stopTimer('black');
      startTimer(game, 'white');
    }
  } else if (!isTimerRunning('black')) {
    stopTimer('white');
    startTimer(game, 'black');
  }
}

export function forceRestartTimers(data) {
  clearTimer('white');
  clearTimer('black');
  updateTimers(data);
}

export function stopAllTimers() {
  stopTimer('white');
  stopTimer('black');
}

export function hideTimers() {
  clearTimer('white');
  clearTimer('black');
  $('#white-time').text('--:--');
  $('#white-think').text('');
  $('#black-time').text('--:--');
  $('#black-think').text('');
}

export default { updateTimers, forceRestartTimers, stopAllTimers, hideTimers };
