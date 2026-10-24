import { KEYS, readBool, writeBool } from './storage';

// Sound is off until the user turns it on (same default as the jQuery build).
class SoundState {
  enabled = $state(readBool(KEYS.sound));
}
export const sound = new SoundState();

export function setSoundEnabled(on: boolean): void {
  sound.enabled = on;
  writeBool(KEYS.sound, on);
}

export function toggleSound(): void {
  setSoundEnabled(!sound.enabled);
}

// Created on first use: a page that never plays a sound never loads the audio files.
let moveAudio: HTMLAudioElement | undefined;
let captureAudio: HTMLAudioElement | undefined;

export function playMoveSound(san: string): void {
  if (!sound.enabled) return;
  const audio = san.includes('x')
    ? (captureAudio ??= new Audio('/audio/Capture.mp3'))
    : (moveAudio ??= new Audio('/audio/Move.mp3'));
  audio.currentTime = 0;
  audio.play().catch(() => {});
}
