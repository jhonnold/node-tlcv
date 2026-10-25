<script lang="ts">
  import { innerHeight } from 'svelte/reactivity/window';
  import { getGameStore } from '$lib/game.svelte';
  import { clampBoard, floor8, getView, kibitzerView, MIN_BOARD } from '$lib/view.svelte';
  import type { ViewerSource } from '$lib/url';
  import Board from '../Board.svelte';
  import EngineCard from '../EngineCard.svelte';
  import EvalBar from '../EvalBar.svelte';
  import PlayerBar from '../PlayerBar.svelte';
  import Panel from '../panel/Panel.svelte';
  import ArrowLegend from './ArrowLegend.svelte';
  import NavControls from './NavControls.svelte';
  import OpeningLine from './OpeningLine.svelte';
  import ResizeHandle from './ResizeHandle.svelte';

  type Props = { source: ViewerSource };
  const { source }: Props = $props();

  const game = getGameStore();
  const view = getView();
  const kib = $derived(kibitzerView(game));

  // Main.dc.html. `below` = board-column height besides the board:
  // player bars 2×56 + gaps 4×8 + nav row (6 + 36) + opening row (18).
  const G = {
    header: 56,
    pad: 20,
    gap: 20,
    engines: 340,
    eval: 12,
    below: 204,
    panelAuto: 440,
    panelMin: 320,
    thumb: 80,
  };
  let mainW = $state(0); // bind:clientWidth on <main> (ResizeObserver), includes padding
  const free = $derived(mainW - 2 * G.pad - G.engines - G.eval - 8 - 2 * G.gap);
  const fitH = $derived((innerHeight.current ?? 0) - G.header - 2 * G.pad - G.below);
  const max = $derived(Math.max(MIN_BOARD, floor8(Math.min(fitH, free - G.panelMin))));
  const size = $derived(clampBoard(view.boardPref ?? Math.min(fitH, free - G.panelAuto), max));
  const cols = $derived(`${G.engines}px ${size + G.eval + 8}px minmax(0, 1fr)`);
</script>

<main
  class="desk"
  bind:clientWidth={mainW}
  style:padding="{G.pad}px"
  style:gap="{G.gap}px"
  style:grid-template-columns={cols}
  style:--board="{size}px"
>
  <section class="engines" aria-label="Engine analysis">
    <div class="cards">
      <div class="top">
        {#if game.engines}<EngineCard engine={game.engines[view.top]} thumb={G.thumb} flipped={view.flipped} />{/if}
      </div>
      {#if kib}
        <div class="mid"><EngineCard engine={kib} thumb={G.thumb} flipped={view.flipped} /></div>
      {/if}
      <div class="bottom">
        {#if game.engines}<EngineCard engine={game.engines[view.bottom]} thumb={G.thumb} flipped={view.flipped} />{/if}
      </div>
    </div>
    <ArrowLegend white={game.game?.white.name ?? ''} black={game.game?.black.name ?? ''} kibitzer={kib?.name ?? null} />
  </section>

  <section class="board-col" aria-label="Board">
    {#if game.players}<PlayerBar side={view.top} {...game.players[view.top]} />{/if}
    <div class="board-row">
      <EvalBar score={game.evalScore} flipped={view.flipped} thickness={G.eval} />
      {#if mainW > 0}
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
    {#if game.players}<PlayerBar side={view.bottom} {...game.players[view.bottom]} />{/if}
    <NavControls variant="desktop" />
    <OpeningLine variant="row" />
    <div class="handle-slot">
      <ResizeHandle
        {size}
        min={MIN_BOARD}
        {max}
        onresize={(px) => (view.boardPref = clampBoard(px, max))}
        oncommit={() => view.commitBoardPref()}
      />
    </div>
  </section>

  <div class="panel">
    <Panel {source} tabs="all" flipped={view.flipped} />
  </div>
</main>

<style>
  .desk {
    flex: 1;
    min-height: 0;
    overflow: auto;
    display: grid;
    grid-template-rows: minmax(0, 1fr);
  }
  section,
  .panel {
    min-width: 0;
    min-height: 0;
  }
  .engines {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .cards {
    min-height: calc(var(--board) + 128px);
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: minmax(0, 1fr) auto minmax(0, 1fr);
    row-gap: 12px;
  }
  .top {
    grid-row: 1;
    align-self: start;
  }
  .mid {
    grid-row: 2;
    align-self: center;
  }
  .bottom {
    grid-row: 3;
    align-self: end;
  }
  .board-col {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .board-row {
    display: flex;
    gap: 8px;
  }
  .handle-slot {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 8px;
    right: -14px;
  }
</style>
