import $ from 'jquery';
import { on } from '../../events/index';
import type { GameEventData } from '../../events/index';

let enabled = false;
let moveAudio: HTMLAudioElement;
let captureAudio: HTMLAudioElement;
let unsubUpdate: (() => void) | null = null;
let unsubState: (() => void) | null = null;
let initialized = false;
let lastMoveCount = 0;

function loadPreference(): boolean {
  return localStorage.getItem('soundEnabled') === 'true';
}

function savePreference(value: boolean) {
  localStorage.setItem('soundEnabled', value.toString());
}

function updateIcon() {
  if (enabled) {
    $('#sound-icon-on').show();
    $('#sound-icon-off').hide();
  } else {
    $('#sound-icon-on').hide();
    $('#sound-icon-off').show();
  }
}

function playSound(isCapture: boolean) {
  if (!enabled) return;

  const audio = isCapture ? captureAudio : moveAudio;
  audio.currentTime = 0;
  audio.play().catch(() => {});
}

function onUpdate(data: GameEventData) {
  if (!initialized) return;

  const moves = data.game.moves;
  if (moves.length <= lastMoveCount) {
    lastMoveCount = moves.length;
    return;
  }

  lastMoveCount = moves.length;
  const lastMove = moves[moves.length - 1];
  playSound(lastMove.move?.includes('x') === true);
}

export function init() {
  moveAudio = new Audio('/audio/Move.mp3');
  captureAudio = new Audio('/audio/Capture.mp3');

  enabled = loadPreference();
  updateIcon();

  $('#sound-toggle').on('click', () => {
    enabled = !enabled;
    savePreference(enabled);
    updateIcon();
  });

  // Listen to game:state to mark initialized — only play sounds for
  // updates that arrive AFTER the initial state load
  unsubState = on('game:state', (data) => {
    lastMoveCount = data.game.moves.length;
    initialized = true;
  });

  unsubUpdate = on('game:update', onUpdate);
}

export function destroy() {
  $('#sound-toggle').off('click');
  if (unsubUpdate) unsubUpdate();
  if (unsubState) unsubState();
  initialized = false;
  lastMoveCount = 0;
}
