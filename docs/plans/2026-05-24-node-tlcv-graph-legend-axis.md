---
ingested: 2026-05-24
source_type: plan
author: Claude Agent (direction + approval by Jay Honnold)
synthesis: done
---

> **Historical (pre-Svelte frontend).** A dated record of past work; paths, routes and build steps here may refer to the old EJS/webpack frontend that the Svelte app in `web/` replaced. See [docs/frontend.md](../frontend.md) for the current app.

# node-tlcv — add legend and move-number x-axis to the eval/graphs chart

> Internal plan, authored and executed on 2026-05-24.
> **Outcome:** implemented and shipped as PR [#159](https://github.com/jhonnold/node-tlcv/pull/159)
> on branch `feat/graph-legend-axis` (squash-merge commit `351c10d`). Single-file,
> frontend-only change. Verified in a real browser (Playwright) against live broadcasts.

## Context

A reported issue (High, from another agent's review): the **Graphs** tab was under-labeled.
It plotted the two engines as a grey line (White) and a dark line (Black), plus a dashed
kibitzer line on the eval graph, with **no legend** (which color is which engine?) and
**no x-axis** (the horizontal axis is move progression, but the x scale was `display: false`).
The ask: a two-swatch legend keyed to the engine names, and a "Move number" x-axis.

## Key findings that shaped the fix

- **The legend option was a no-op because the plugin was never registered.**
  `public/js/components/graphs/index.ts` registered `LineController, LineElement,
  PointElement, LinearScale, CategoryScale, Tooltip` — no `Legend`. In Chart.js v4's
  tree-shakeable build the `Legend` plugin must be registered before
  `plugins.legend.display: true` has any effect. (Axis/scale **titles** are rendered
  by the scale itself and need no extra registration — only `Legend` had to be added.)
- **Engine names were already in frontend state, just unused.** `storeGameData()` kept
  only `game.moves`; `SerializedGame.white.name` / `.black.name` were available, and the
  kibitzer engine name sits on `game.kibitzerLiveData?.name` (live-data only, nullable —
  per-move `KibitzerMeta` has no name).
- **The category labels were already move notation.** `buildChartData()` already builds
  `labels[i]` as `"12. Nf3"` (white) / `"12... c5"` (black); these feed the tooltip title
  and had to stay. So the x-axis ticks derive from those labels via callback, not a new
  data array.
- **One x-axis config serves all five graph types.** The x options live once in `index.ts`
  (not per-type in `graph-types.ts`), and eval/depth/nodes/nps/time are all per-move —
  `"Move number"` applies to all.
- **Theme is handled for free.** Colors are read from CSS custom properties via `getCssVar()`
  at chart-creation time, and `theme:change` destroys + recreates the chart — so legend/axis
  text picks up dark-mode colors with no extra wiring.

## Change (1 file, frontend-only)

All in `public/js/components/graphs/index.ts`:

- **Register `Legend`** and enable a top legend (`position: 'top'`, `boxWidth: 16`,
  `boxHeight: 10`).
- **Key the legend to engine names**: capture white/black/kibitzer names in
  `storeGameData()`; use them as dataset labels (falling back to `White`/`Black`/`Kibitzer`).
  Add `backgroundColor` to each dataset so the legend renders a **solid** color swatch.
- **Add a "Move number" x-axis**: a tick `callback` runs `this.getLabelForValue(value)`,
  matches `/^(\d+)\.\s/` to surface the move number under each white half-move (black
  returns `''`), with `autoSkip: true, maxRotation: 0` to thin them.
- **Keep labels fresh** in `refreshChart()` so the legend tracks the engines when the
  game changes.

## Verification (Playwright against live broadcasts)

The eval per-move score comes from low-priority PV messages, which the backend **skips
when a broadcast has zero viewers** — so historical moves played before joining have null
scores, and a populated eval graph only accrues from the moment a browser is viewing.
Confirmed empirically (graph filled only from the join point forward).

- Ran a dev instance from a git worktree (`PORT=8081`, `TLCV_PASSWORD` passed inline).
  Connected to the configured live broadcasts.
- **Eval (light + dark):** legend shows the two engine names + "Kibitzer" with colored
  swatches; bottom axis titled "Move number" with numeric ticks; legend and axis text
  recolor correctly under dark theme.
- **Time graph:** two-swatch legend (no Kibitzer — that dataset is eval-only) + the
  shared x-axis.
- **Fuller game (moves 1–12):** caught a fresh game start; x-axis labeled the full move
  range and the legend updated to the new pairing, confirming `refreshChart()` keeps
  labels live.
- Frontend typecheck (`tsc -p tsconfig.frontend.json`) and webpack `prebuild` pass.

## Related

- [[node-tlcv]] — the service; graphs live in `public/js/components/graphs/` (Chart.js v4)
- [[2026-05-24-node-tlcv-board-a11y-screen-reader]] — sibling 2026-05-24 fix
- [[2026-05-24-node-tlcv-mobile-card-overflow-fix]] — sibling 2026-05-24 fix
