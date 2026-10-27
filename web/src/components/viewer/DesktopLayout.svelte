<script lang="ts">
  import { innerHeight } from 'svelte/reactivity/window';
  import { getGameStore } from '$lib/game.svelte';
  import { clamp, clampBoard, floor8, getView, kibitzerView, MIN_BOARD } from '$lib/view.svelte';
  import type { HeaderInfo } from '$lib/view.svelte';
  import type { ViewerSource } from '$lib/url';
  import Board from '../Board.svelte';
  import EngineCard from '../EngineCard.svelte';
  import EvalBar from '../EvalBar.svelte';
  import PlayerBar from '../PlayerBar.svelte';
  import Panel from '../panel/Panel.svelte';
  import EventCard from './EventCard.svelte';
  import NavControls from './NavControls.svelte';
  import ResizeHandle from './ResizeHandle.svelte';

  type Props = { source: ViewerSource; info: HeaderInfo };
  const { source, info }: Props = $props();

  const game = getGameStore();
  const view = getView();
  const kib = $derived(kibitzerView(game));

  // Lichess2.dc.html: one fluid layout, sampled at 1440×900 ("desktop") and 1920×1080 ("large").
  // Grid areas: meta | board | table over chat | board | table.
  const HEADER = 56;
  const BARS = 112; // board column besides the board: 2 player bars (48) + 2 gaps (8)
  const NAV = 66; // NavControls desktop block: buttons 40 + gap 6 + status row 20
  const ROW = 8; // gap between table-column rows
  const PANEL_MIN = 240; // the tabs panel never gets shorter; a shorter window scrolls
  const TABLE_MIN = 390;
  const TABLE_MAX = 520;
  const EV_GAP = 8;

  let w = $state(0); // <main> clientWidth: padding included, scrollbar excluded
  let cardH = $state(0); // rendered short EngineCard height (fixed by the card, independent of the PV)
  const t = $derived(clamp((w - 1440) / 480, 0, 1)); // 0 at ≤ 1440, 1 at ≥ 1920
  const pad = $derived(Math.round(20 + 4 * t)); // page padding and column gap: 20 → 24
  const ev = $derived(Math.round(12 + 2 * t)); // eval bar: 12 → 14
  const thumb = $derived(t < 0.5 ? 72 : 80); // short-card PV-end board
  const chatW = $derived(Math.round(clamp(280 + (w - 1440) / 4, 240, 400))); // 240 @1280, 280 @1440, 400 @1920+
  // The board fills the window height, leaving the table at least TABLE_MIN; the resize handle can shrink it.
  const fitH = $derived((innerHeight.current ?? 0) - HEADER - 2 * pad - BARS);
  const fitW = $derived(w - 4 * pad - chatW - TABLE_MIN - ev - EV_GAP);
  const max = $derived(Math.max(MIN_BOARD, floor8(Math.min(fitH, fitW))));
  const size = $derived(clampBoard(view.boardPref ?? max, max));
  const boardW = $derived(size + ev + EV_GAP);
  // The table takes the remaining width up to TABLE_MAX; past that the grid is centred.
  const tableW = $derived(Math.floor(clamp(w - 4 * pad - chatW - boardW, TABLE_MIN, TABLE_MAX)));
  // Board column, table column and meta + chat share one height; the tabs panel keeps at least PANEL_MIN.
  const tableMin = $derived(2 * cardH + NAV + PANEL_MIN + 3 * ROW + (kib ? cardH + ROW : 0));
  const colH = $derived(Math.max(size + BARS, tableMin));
  // Keep the board's right edge under the pointer (Decision 5). In board-column px, the edge is at B while the
  // table is below its cap (left-anchored grid), and at (B + Bcap) / 2 once the table is capped (centred grid).
  function dragTo(px: number, from: number): void {
    const bcap = w - 4 * pad - chatW - TABLE_MAX;
    const b0 = from + ev + EV_GAP;
    const x = (b0 >= bcap ? b0 : (b0 + bcap) / 2) + (px - from);
    const b = x >= bcap ? x : 2 * x - bcap;
    view.boardPref = clampBoard(b - ev - EV_GAP, max);
  }
</script>

<main class="desk" bind:clientWidth={w} style:padding="{pad}px">
  <div
    class="grid"
    style:gap="{pad}px"
    style:height="{colH}px"
    style:grid-template-columns="{chatW}px {boardW}px {tableW}px"
  >
    <div class="meta"><EventCard {info} /></div>

    <!-- Always the chatOnly Panel: on archives and replays it shows U11's empty-state line. -->
    <section class="chat" aria-label="Chat">
      <Panel {source} tabs="chatOnly" />
    </section>

    <section class="board-col" aria-label="Board" style:--ev-off="{ev + EV_GAP}px">
      {#if game.players}
        <div class="bar"><PlayerBar side={view.top} {...game.players[view.top]} /></div>
      {/if}
      <div class="board-row" style:gap="{EV_GAP}px">
        <EvalBar score={game.evalScore} flipped={view.flipped} thickness={ev} />
        {#if w > 0}
          <Board
            fen={game.fen}
            {size}
            flipped={view.flipped}
            lastMove={game.lastMove}
            arrows={game.arrows}
            label="Main board"
          />
        {/if}
      </div>
      {#if game.players}
        <div class="bar"><PlayerBar side={view.bottom} {...game.players[view.bottom]} /></div>
      {/if}
      <div class="handle-slot" style:right="{-(pad / 2 + 4)}px">
        <ResizeHandle {size} min={MIN_BOARD} {max} onresize={dragTo} oncommit={() => view.commitBoardPref()} />
      </div>
    </section>

    <section class="table" aria-label="Engines, moves and tabs">
      <div bind:offsetHeight={cardH}>
        {#if game.engines}<EngineCard engine={game.engines[view.top]} {thumb} flipped={view.flipped} />{/if}
      </div>
      <NavControls variant="desktop" />
      <div class="tabs"><Panel {source} tabs="noChat" /></div>
      {#if kib}<EngineCard engine={kib} {thumb} flipped={view.flipped} />{/if}
      {#if game.engines}<EngineCard engine={game.engines[view.bottom]} {thumb} flipped={view.flipped} />{/if}
    </section>
  </div>
</main>

<style>
  .desk {
    flex: 1;
    min-height: 0;
    overflow: auto;
  }
  .grid {
    display: grid;
    justify-content: center;
    grid-template-rows: auto minmax(0, 1fr);
    grid-template-areas:
      'meta board table'
      'chat board table';
  }
  .meta {
    grid-area: meta;
    min-width: 0;
  }
  .chat {
    grid-area: chat;
    min-width: 0;
    min-height: 0;
  }
  .board-col {
    grid-area: board;
    align-self: start;
    position: relative;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .bar {
    padding-left: var(--ev-off);
  }
  .board-row {
    display: flex;
  }
  .handle-slot {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 8px;
  }
  .table {
    grid-area: table;
    min-width: 0;
    min-height: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .tabs {
    flex: 1 1 0;
    min-height: 0;
  }
</style>
