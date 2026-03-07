// public/js/components/game/timers.js
import $ from 'jquery';
import type { SerializedGame } from '../../../../shared/types';
import type { GameEventData } from '../../events/index';

const timerIntervals = new Map<string, ReturnType<typeof setInterval>>();

function msToString(ms: number) {
  const s = Math.floor((ms / 1000) % 60);
  const m = Math.floor(ms / 1000 / 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function updateTimer(time: number, start: number, color: string) {
  const used = new Date().getTime() - start;
  $(`#${color}-time`).html('');
  $(`#${color}-time`).append($('<mark>').text(msToString(Math.max(0, time - used))));
  $(`#${color}-think`).text(msToString(used));
}

function clearTimer(color: string) {
  clearInterval(timerIntervals.get(color));
  timerIntervals.delete(color);
}

function stopTimer(color: string) {
  clearTimer(color);
  const mark = $(`#${color}-time`).find('mark');
  if (mark.length) $(`#${color}-time`).text(mark.text());
}

function startTimer(game: SerializedGame, color: 'white' | 'black') {
  const time = game[color].clockTime;
  const start = game[color].startTime;

  updateTimer(time, start, color);
  timerIntervals.set(
    color,
    setInterval(() => updateTimer(time, start, color), 1000),
  );
}

function isTimerRunning(color: string) {
  return timerIntervals.has(color);
}

export function updateTimers(data: GameEventData | { game: SerializedGame }) {
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

export function forceRestartTimers(data: GameEventData | { game: SerializedGame }) {
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
