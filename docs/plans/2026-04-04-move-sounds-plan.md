# Move Sounds Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Play distinct audio clips (move vs capture) when live moves arrive, with a mute toggle in the header.

**Architecture:** New `sounds` component subscribes to `game:update` events, checks `newMoves` for captures via SAN `x` character, and plays the appropriate preloaded `Audio` object. A header button toggles mute state persisted in localStorage.

**Tech Stack:** Web Audio (`new Audio()`), Lichess sound assets, existing event bus + jQuery patterns.

---

### Task 1: Add audio files

**Files:**
- Create: `public/audio/Move.mp3`
- Create: `public/audio/Capture.mp3`

**Step 1: Download Lichess sounds**

```bash
curl -L -o public/audio/Move.mp3 "https://github.com/lichess-org/lila/raw/master/public/sound/standard/Move.mp3"
curl -L -o public/audio/Capture.mp3 "https://github.com/lichess-org/lila/raw/master/public/sound/standard/Capture.mp3"
```

**Step 2: Add audio directory to webpack CopyWebpackPlugin**

In `webpack/webpack.common.js`, add a new pattern to the CopyWebpackPlugin so audio files are copied to the build output alongside images.

Find:
```javascript
patterns: [
  { from: './public/img', to: './img' },
```

Add after:
```javascript
  { from: './public/audio', to: './audio' },
```

**Step 3: Commit**

```bash
git add public/audio/ webpack/webpack.common.js
git commit -m "feat(sounds): add Lichess move/capture audio files and copy to build"
```

---

### Task 2: Add sound toggle button to header

**Files:**
- Modify: `views/partials/header.ejs`

**Step 1: Add the button**

Insert before the theme toggle button (before line 17), guarded by `showFlip` the same way the flip button is (sound toggle only makes sense on the game page):

```ejs
<% if (typeof showFlip !== 'undefined' && showFlip) { %>
<button id="sound-toggle" class="header-btn" title="Toggle move sounds">
  <svg id="sound-icon-on" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:none"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path><path d="M15.54 8.46a5 5 0 0 1 0 7.08"></path></svg>
  <svg id="sound-icon-off" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:none"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><line x1="23" y1="9" x2="17" y2="15"></line><line x1="17" y1="9" x2="23" y2="15"></line></svg>
</button>
<% } %>
```

Both icons start `display:none` — the component JS will show the correct one on init.

**Step 2: Commit**

```bash
git add views/partials/header.ejs
git commit -m "feat(sounds): add sound toggle button to header"
```

---

### Task 3: Create sounds component

**Files:**
- Create: `public/js/components/sounds/index.ts`

**Step 1: Write the component**

```typescript
import $ from 'jquery';
import { on } from '../../events/index';
import type { GameEventData } from '../../events/index';

let enabled = false;
let moveAudio: HTMLAudioElement;
let captureAudio: HTMLAudioElement;
let unsubUpdate: (() => void) | null = null;
let unsubState: (() => void) | null = null;
let initialized = false;

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
  if (!moves.length) return;

  const lastMove = moves[moves.length - 1];
  if (lastMove.move?.includes('x')) {
    playSound(true);
  } else {
    playSound(false);
  }
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
  unsubState = on('game:state', () => {
    initialized = true;
  });

  unsubUpdate = on('game:update', onUpdate);
}

export function destroy() {
  $('#sound-toggle').off('click');
  if (unsubUpdate) unsubUpdate();
  if (unsubState) unsubState();
  initialized = false;
}
```

Key details:
- `initialized` flag prevents playing sounds on the initial `game:state` load (which could contain many moves).
- Only `game:update` triggers sound. The `onUpdate` handler checks the **last** move in the array since `newMoves` get merged into `moves` before the event fires.
- `audio.play().catch(() => {})` silences browser autoplay warnings if the user hasn't interacted yet.

**Step 2: Commit**

```bash
git add public/js/components/sounds/index.ts
git commit -m "feat(sounds): create sounds component with move/capture detection"
```

---

### Task 4: Wire sounds component into main entry point

**Files:**
- Modify: `public/js/index.ts`

**Step 1: Add import**

Add after the flip import (line 20):

```typescript
import { init as initSounds } from './components/sounds/index';
```

**Step 2: Add init call**

Add `initSounds();` after `initFlip();` (after line 93):

```typescript
  initSounds();
```

**Step 3: Commit**

```bash
git add public/js/index.ts
git commit -m "feat(sounds): wire sounds component into main entry point"
```

---

### Task 5: Build and verify

**Step 1: Run build**

```bash
npm run build
```

Expected: Clean build with no TypeScript or webpack errors.

**Step 2: Verify audio files in build output**

```bash
ls build/public/audio/
```

Expected: `Move.mp3` and `Capture.mp3` present.

**Step 3: Commit all together if any fixups were needed**

If the build required fixes, commit them. Otherwise this task is just verification.
