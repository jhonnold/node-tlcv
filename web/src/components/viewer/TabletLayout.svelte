<script lang="ts">
  import { innerHeight } from 'svelte/reactivity/window';
  import { getGameStore } from '$lib/game.svelte';
  import { clamp, floor8, getView, kibitzerView } from '$lib/view.svelte';
  import type { HeaderInfo } from '$lib/view.svelte';
  import type { ViewerSource } from '$lib/url';
  import Board from '../Board.svelte';
  import EngineCard from '../EngineCard.svelte';
  import EvalBar from '../EvalBar.svelte';
  import PlayerBar from '../PlayerBar.svelte';
  import Panel from '../panel/Panel.svelte';
  import EventCard from './EventCard.svelte';
  import NavControls from './NavControls.svelte';

  type Props = { source: ViewerSource; info: HeaderInfo };
  const { source, info }: Props = $props();

  const game = getGameStore();
  const view = getView();
  const kib = $derived(kibitzerView(game));

  // Lichess2.dc.html size=tablet (834): meta / board | table / tabs. The board leaves the table at least
  // TABLE_MIN and its column fits the window height; the table takes the rest up to TABLE_MAX, then the grid centres.
  const PAD = 16; // page padding and grid gap
  const EV = 10;
  const EV_GAP = 6;
  const BARS = 112; // 2 compact player bars (48) + 2 gaps (8)
  const THUMB = 56;
  const TABLE_MIN = 270;
  const TABLE_MAX = 360;

  let w = $state(0); // <main> clientWidth
  const fitW = $derived(w - 3 * PAD - TABLE_MIN - EV - EV_GAP);
  const fitH = $derived((innerHeight.current ?? 0) - 56 - 2 * PAD - BARS);
  const size = $derived(Math.max(240, floor8(Math.min(fitW, fitH))));
  const boardW = $derived(size + EV + EV_GAP);
  const tableW = $derived(Math.floor(clamp(w - 3 * PAD - boardW, TABLE_MIN, TABLE_MAX)));
</script>

<main class="tab" bind:clientWidth={w}>
  <div class="grid" style:grid-template-columns="{boardW}px {tableW}px">
    <div class="meta"><EventCard {info} /></div>

    <section class="board-col" aria-label="Board" style:--ev-off="{EV + EV_GAP}px">
      {#if game.players}
        <div class="bar"><PlayerBar compact side={view.top} {...game.players[view.top]} /></div>
      {/if}
      <div class="board-row" style:gap="{EV_GAP}px">
        <EvalBar thickness={EV} score={game.evalScore} flipped={view.flipped} />
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
        <div class="bar"><PlayerBar compact side={view.bottom} {...game.players[view.bottom]} /></div>
      {/if}
    </section>

    <section class="table" aria-label="Engines and navigation">
      <div>
        {#if game.engines}<EngineCard short engine={game.engines[view.top]} thumb={THUMB} flipped={view.flipped} />{/if}
      </div>
      <div class="mid">
        {#if kib}<EngineCard short engine={kib} thumb={THUMB} flipped={view.flipped} />{/if}
        <NavControls variant="tablet" />
      </div>
      <div>
        {#if game.engines}<EngineCard
            short
            engine={game.engines[view.bottom]}
            thumb={THUMB}
            flipped={view.flipped}
          />{/if}
      </div>
    </section>

    <section class="tabs" aria-label="Moves and tournament">
      <Panel {source} tabs="chatFirst" touch height="clamp(480px, calc(100dvh - 88px), 640px)" />
    </section>
  </div>
</main>

<style>
  .tab {
    padding: 16px;
  }
  .grid {
    display: grid;
    gap: 16px;
    justify-content: center;
    grid-template-areas:
      'meta meta'
      'board table'
      'tabs tabs';
  }
  .meta {
    grid-area: meta;
    min-width: 0;
  }
  .board-col {
    grid-area: board;
    align-self: start;
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
  .table {
    grid-area: table;
    min-width: 0;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    gap: 8px;
  }
  .mid {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .tabs {
    grid-area: tabs;
    min-width: 0;
  }
</style>
