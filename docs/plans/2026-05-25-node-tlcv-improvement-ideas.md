---
ingested: 2026-06-04
source_type: plan
author: Claude Code (with direction from Jay Honnold)
synthesis: done
---

# node-tlcv — improvement ideas (candidate backlog)

> **Not a roadmap.** A living catalogue of *candidate* improvements for
> [[node-tlcv]], to iterate on over time. No commitments, no dates, no
> ordering promises — items carry a rough `effort/impact` and a `status`
> we can bump as things get picked up or discarded. The synthesized
> short version lives on the [[node-tlcv]] entity under **Improvement ideas**;
> this file is the raw detail.

**Hard constraint.** Jay does not control the upstream **TLCS** chess server
or the data it streams. Every idea here builds *on top of* data that already
arrives (positions, moves, clocks, PVs, chat, spectator joins, the CT
crosstable dump) plus what the server already derives (kibitzer/engine evals,
persisted PGN + meta sidecars + `tournament-results.json`). Nothing here
assumes a new upstream message.

## How this was derived

1. Read-only review of the backend (`src/`, `shared/`) and frontend
   (`public/js/`, `views/`, `public/css/`).
2. Live walk-through of `ccrl.live` with Playwright on 2026-05-25:
   homepage, a live viewer (`/16061`), **all six tabs** (Chat, Moves,
   Graphs, Results, Games, Details), mobile layout (390 px), and the theme
   editor modal. Screenshots captured.
3. Cross-checked against shipped PRs (to exclude done work) and the four
   open GitHub issues (#57, #114, #22, #70).

## Live-site observations (2026-05-25)

What the running site actually shows — the evidence behind the catalogue:

- **Homepage** — grid of live broadcast cards (mini board, two engines,
  clocks, move no.) + a flat **~70-entry archive list**. No per-card
  **spectator/viewer count**, no sort/filter; archive has no search/filter/
  pagination.
- **Viewer** — board with a single PV arrow, two engine cards showing
  `Score / Depth / Nodes / Nps / clock` as **bare numbers** (no eval bar),
  each with a mini PV board. "No kibitzer active" on this broadcast
  (expected — targeting follows viewer count).
- **Moves tab** — `# / White / Black` only. **No think-time** (the `time`
  metadata exists but isn't shown), no per-move eval, no move-quality glyphs.
- **Graphs tab** — *strong already*: legend, "Move number" x-axis, 5 metric
  types (Eval/Depth/Nodes/NPS/Time). No work needed.
- **Results tab** — the raw TLCS CT crosstable (`=`/`1`/`0`/`.`), up to ~24
  engines wide. For **gauntlets** (most broadcasts) every non-gauntlet row is
  mostly `.`; cramped and hard to read. Shows only `G` and `Pts` — **no
  W-L-D or score %**, no sort/filter/row-highlight.
- **Games tab** — `# / White / Black / Result / View / PGN`, **475 rows**,
  no filter/search/pagination.
- **Details tab** — nearly empty: just "PGN Archive" and "Current Game PGN"
  links over a screenful of dead space.
- **Mobile (390 px)** — *good already*: single-column stack, mini PV boards
  correctly hidden, tab bar scrolls.
- **Theme modal** — *mature already*: Light/Dark/Custom, Page/Board split,
  Advanced sections, piece-set dropdown, **live preview**, Reset to preset.
- **Console** — clean apart from a blocked Google-Analytics tag
  (environmental on the review machine, not a site bug). URL stays `/16061`
  across every tab and move → **no deep-link to a position**.

## Candidate ideas

Status legend: `idea` (captured) · `exploring` · `building` · `shipped` · `dropped`.

### A. Reliability & self-healing (backend)

Highest-leverage backend work. Complements the existing Grafana alerting
([[2026-05-23-ccrl-outage-alerting-plan]]) — today the system *detects*
outages but cannot *recover*.

- **A1 — Kibitzer auto-reconnect.** On engine `exit` / SSH `close`
  (`local-transport.ts:40`, `ssh-transport.ts:63`) the transport sets
  `ready=false` and goes dark with no retry. Add backoff reconnection. The
  `create`/`teardown` vs `startAnalysis`/`stopAnalysis` split already
  supports this cleanly. *Medium / high. status: idea.*
- **A2 — UDP broadcast self-healing.** `UdpTransport` has an `onError` but no
  reconnect (`udp-transport.ts:23`). Auto-reconnect (re-LOGON) with backoff
  on error/silence — directly prevents the silent-outage class the alerting
  was built to catch. *Medium / high. status: idea.*
- **A3 — Graceful shutdown.** No `SIGTERM`/`SIGINT` handlers anywhere in
  `src/`. Cleanly tear down broadcasts, SSH sessions, child engines before
  exit — matters for the `systemctl restart tlcv` deploy flow. *Low /
  medium. status: idea.*
- **A4 — Config-write serialization.** `config-store` read-then-write can
  race two admin actions. `async-lock` is already a dependency. *Low /
  low–medium. status: idea.*

### B. Analytical surfaces (frontend, on existing data)

- **B1 — Results crosstable rework.** Two wins from data already in the CT
  result strings: (a) derive & show **W-L-D + score %** per engine; (b) a
  **gauntlet-aware view** — detect the one engine with `G ≫ others` and
  render a clean "gauntlet vs each opponent" record instead of the sparse
  matrix. Plus row highlight, sticky engine-name column, filter. *Medium /
  high — the heart of what the audience reads. status: idea.*
- **B2 — Evaluation bar.** A vertical advantage bar by the board, driven by
  the kibitzer/engine scores already on the cards (bare numbers today).
  *Medium / high. status: idea.*
- **B3 — Richer move list.** Surface per-move **think-time** (already in
  metadata) + eval, and **move-quality glyphs** (`!`/`?`/`??`) derived from
  eval deltas. *Low–medium / medium. status: idea.*
- **B4 — Fill the Details tab.** Natural, zero-architecture home for
  **broadcast metadata**: time control, hardware/CPU, opening book, ECO,
  start time, games played/remaining, current leader. *Low / medium.
  status: idea.*

### C. Sharing & navigation

- **C1 — Deep-link to a move/position.** Encode move index in the URL (e.g.
  `?m=42`). Today the URL never changes, so an exact position can't be
  shared. *Low–medium / high for sharing. status: idea.*
- **C2 — Embeddable board widget.** Minimal iframe view for the CCRL
  discussion board / TalkChess. Pairs with C1. *Medium / medium.
  status: idea.*
- **C3 — Search/filter on big tables.** Results, Games (475 rows), and the
  homepage archive index (~70 entries, will only grow). *Medium / medium.
  status: idea.*
- **C4 — Homepage card spectator counts + sort.** Show how many are watching
  each live card; allow sorting. (Spectator set already exists; ties to E2 /
  issue #22.) *Low–medium / medium. status: idea.*

### D. Accessibility (in-game viewer)

The home cards got a11y attention ([[2026-05-24-node-tlcv-board-a11y-screen-reader]]);
the **viewer** did not.

- **D1 — Tab bar semantics.** Tabs render as plain buttons — add
  `role="tab"` / `role="tablist"` / `aria-selected`. *Low / medium.
  status: idea.*
- **D2 — Icon-button labels.** Flip / sound / theme / focus / copy-FEN rely
  on `title` only; add `aria-label`. *Low / low–medium. status: idea.*
- **D3 — Live regions.** `aria-live="polite"` on the move list and chat box
  so new moves/messages are announced. *Low–medium / medium. status: idea.*

### E. Notifications & engagement

- **E1 — "Engine about to move" / game-finished notification.** Browser/desktop
  notification and/or tab-title flash. Reuses the existing sound infra and
  webhook event model. *(GitHub issue #57.)* *Medium / medium. status: idea.*
- **E2 — Surface spectators to web viewers.** The `ADDUSER`/`DELUSER`
  spectator set is tracked but the native-client spectator list/count isn't
  shown prominently. *(GitHub issue #22.)* *Low–medium / low. status: idea.*

### F. Data & exports

- **F1 — Annotated PGN export.** Augment exported PGN with per-move comments:
  eval, clock/think-time, kibitzer best line. Raises the value of an endpoint
  people already use (Games + Details tabs). *Medium / high. status: idea.*
- **F2 — Cross-tournament / per-engine stats.** Aggregate the persisted
  `tournament-results.json` + per-game meta sidecars into per-engine and
  head-to-head pages (record by color, opening repertoire, avg think-time).
  New read-only routes + a panel. *Medium–high / medium. status: idea.*

### G. Foundations

- **G1 — Tests for the pure parsers.** `result-parser.ts`, `uci-parser.ts`,
  `protocol.ts`, `slugs.ts` are pure and trivially testable; a captured-
  message replay fixture would exercise `game-service` end-to-end. The repo
  has **no test runner** today, and frontend churn (themes/graphs/etc.) keeps
  passing through these. *Low to start / high confidence-of-change.
  status: idea.*
- **G2 — Clipboard API.** Replace deprecated `execCommand('copy')` in
  `public/js/utils/fen.ts`. *Trivial. status: idea.*

### H. Open GitHub issues (mapping)

- **#57** Notifications when engine about to play → **E1**.
- **#22** Communicate tlcv.net spectators to normal users → **E2 / C4**.
- **#114** Make the chat box configurable by user → standalone *(Low/low,
  status: idea)*.
- **#70** Engines that send Chess960 castling *(bug)* → FRC/960 castling
  notation breaks parsing. Niche but a correctness bug. *Medium / low–medium.
  status: idea.*

## Already shipped — explicitly excluded

Confirmed against merged PRs; **do not re-propose**: dynamic custom themes,
board/page theme split, piece-set selection, move sounds, chat markdown,
tournament archive + legacy fallback, persisted tournament results,
Prometheus metrics + Grafana alerting, graph legend/axis, broadcast-card
a11y, mobile card overflow, configurable `PORT`, live spectator updates,
rename-clears-chat fix, opening-lookup self-disable.

## Re-evaluated after the live review — dropped

The static review flagged these; the live walk-through shows they're already
good: **theme system** (has live preview + advanced + piece sets + reset),
**graphs** (legend + move-number axis + 5 metric types), **mobile** (clean
single-column, PV boards hidden, tabs scroll).

## Related

- [[node-tlcv]] — the project; **Improvement ideas** section synthesizes this
- [[2026-05-23-ccrl-outage-alerting-plan]] — the detect-side of A1–A3 (this is the recover-side)
- [[2026-05-24-node-tlcv-persist-tournament-results]] — the data F2 / B1 build on
- [[2026-05-24-node-tlcv-board-a11y-screen-reader]] — home-card a11y; D1–D3 extend it to the viewer
- [[2026-05-24-node-tlcv-previous-broadcasts]] — the archive index C3 would add search to
