---
source_url: ""
ingested: 2026-06-05
source_type: plan
synthesis: done
---

# node-tlcv: Focus View Engine Info (PR #174)

Plan and implementation record for adding engine names, evaluations, and clocks to
focus mode on the broadcast page (ccrl.live). Shipped as PR #174 on 2026-06-05.

## Problem

Focus mode maximized the board and hid everything — header, footer, info cards, chat,
board footer. Viewers had no context: no engine names, no evals, no clocks.

## Decision

Add two compact player strips outside the board (above and below), Lichess-style:
- **Content:** engine name (left), numeric eval + remaining clock (right). No PV or depth.
- **Layout:** strips are siblings of `#board-container` inside `.main-layout` (NOT inside
  the container), so `#board-container` square sizing is unaffected.
- Board shrinks to make room: `min(100vw, calc(100vh - 2 * var(--focus-strip-h)))`.
- **Validation:** live Playwright MCP against `GrahamCCRL.dyndns.org:16061`.

## Implementation (5 files)

| File | Change |
|------|--------|
| `views/pages/index.ejs` | `#focus-info-top` / `#focus-info-bottom` strips with `.focus-name`, `.focus-score`, `.focus-time` spans |
| `public/css/_focus.scss` | `flex-direction: column` on `.main-layout`; `--focus-board-size` CSS var; strip styles; `box-sizing: border-box`; `width: 100vw` on layout; responsive `@media (max-width:767px)` |
| `public/js/components/focus/index.ts` | Full renderer: subscribes to `game:state`, `game:update`, `nav:position`, `board:flip`; runs its own 1s clock interval; flip-aware `topColor()`/`bottomColor()`; replay detection |
| `public/js/components/game/player-info.ts` | `export function formatScore` |
| `public/js/components/game/timers.ts` | `export function msToString` |

## Key design details

**Eval source (mirrors player-info.ts `update()`):**
- Thinking side: `formatScore(game.liveData.score, color)` (white-perspective, negated for black)
- Non-thinking side: eval from `game.moves[moves.length-1]` (last completed move)
- Historical nav: backward search for most recent eval for each color in `game.moves`

**Clock:**
- Only for side-to-move, only when `!isReplayMode()` and `clockTime > 0`
- `msToString(Math.max(0, clockTime - (Date.now() - startTime)))` every 1s
- Non-ticking side: static remaining time; archive/replay: `--:--`

**Flip:** module-level `flipped` flag tracks `board:flip` events (same pattern as
`board/index.ts`). `topColor()` returns the player at the top of the board.

**CSS specificity fix:** strips hidden via `.focus-info { display: none }` (class
selector, specificity 10) not ID selector, so `body.focus-mode .focus-info { display: flex }`
(specificity 21) can override without `!important`.

**Mobile fix:** `box-sizing: border-box` on strips + `width: 100vw` on `.main-layout`
to prevent the first character of engine names being clipped off-screen (root cause:
`content-box` width of 390px + 11.2px padding = 401.2px total, centered in a
374px layout = -13.6px left offset).

## Verification (all passed)

- Live broadcast: names, evals, ticking clock verified via Playwright + `browser_evaluate`
- Flip: strips swapped correctly when board flipped
- Escape exits cleanly, normal layout restores
- Archive (PZChessBot_4CPU_Gauntlet): names render, clocks `--:--`, no JS errors
- Mobile 390×844: full names visible after fix
- `npm run build` (webpack + tsc) clean
