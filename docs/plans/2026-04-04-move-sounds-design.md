# Move Sounds Design

## Overview

Play a short audio clip when a new move arrives on a live broadcast. Two distinct sounds: one for regular moves, one for captures. Muted by default, toggled via a header button.

## Audio

- Two files sourced from Lichess (AGPL-licensed): `Move.mp3` and `Capture.mp3`, placed in `public/audio/`.
- Capture detection: check if SAN move string in `MoveMetaData.move` contains `x`.
- Use `new Audio()` to preload and play. No additional dependencies.

## Mute/Unmute Button

- New `<button id="sound-toggle" class="header-btn">` in `header.ejs`, placed between flip toggle and theme toggle.
- Two SVG icons: speaker (unmuted) and speaker-off (muted), toggling visibility like the theme button does with sun/moon.
- State persisted in `localStorage` key `soundEnabled` (`'true'`/`'false'`, default `'false'`).

## Component

- New file `public/js/components/sounds/index.ts` following the existing `init()`/`destroy()` pattern.
- Subscribes to `game:update` event, checks for `newMoves` in the delta.
- On each new move: if sound enabled, play the appropriate clip.
- Click handler on `#sound-toggle` toggles state and icon visibility.

## Styles

- No new SCSS partial needed. The existing `.header-btn` mixin from `_header.scss` already styles the button identically to flip/theme toggles.

## Wiring

- Import and call `init()`/`destroy()` from `public/js/index.ts` alongside the other components.

## Out of Scope

- Navigation sounds
- Volume control
- Per-game or per-tab sound settings
- Custom event emission (no other component needs to know about sound state)
