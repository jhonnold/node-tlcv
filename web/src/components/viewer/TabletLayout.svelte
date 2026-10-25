<script lang="ts">
  import { innerHeight } from 'svelte/reactivity/window';
  import { getGameStore } from '$lib/game.svelte';
  import { floor8, getView, kibitzerView } from '$lib/view.svelte';
  import type { ViewerSource } from '$lib/url';
  import Board from '../Board.svelte';
  import EngineCard from '../EngineCard.svelte';
  import EvalBar from '../EvalBar.svelte';
  import PlayerBar from '../PlayerBar.svelte';
  import Panel from '../panel/Panel.svelte';
  import KibitzerStrip from './KibitzerStrip.svelte';
  import NavControls from './NavControls.svelte';

  type Props = { source: ViewerSource };
  const { source }: Props = $props();

  const game = getGameStore();
  const view = getView();
  const kib = $derived(kibitzerView(game));

  let w = $state(0);
  const avail = $derived((innerHeight.current ?? 0) - 56 - 32); // viewport below the header, less padding
  // Padding 32, eval 10, gaps 8+14, right column ≥ 270; the board plus the nav row fit the viewport; capped at 640.
  const size = $derived(floor8(Math.max(240, Math.min(w - 32 - 10 - 8 - 14 - 270, avail - 56, 640))));
  const panelH = $derived(Math.max(420, avail - size - 24 - 44 - (kib ? 56 : 0)));
</script>

<main class="tab" bind:clientWidth={w}>
  <div class="top">
    <div class="board-row">
      <EvalBar thickness={10} score={game.evalScore} flipped={view.flipped} />
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
    <div class="side" style:min-height="{size}px">
      <div class="grp">
        {#if game.players}<PlayerBar compact side={view.top} {...game.players[view.top]} />{/if}
        {#if game.engines}<EngineCard compact engine={game.engines[view.top]} />{/if}
      </div>
      <div class="grp">
        {#if game.engines}<EngineCard compact engine={game.engines[view.bottom]} />{/if}
        {#if game.players}<PlayerBar compact side={view.bottom} {...game.players[view.bottom]} />{/if}
      </div>
    </div>
  </div>
  <NavControls variant="tablet" />
  {#if kib}<KibitzerStrip engine={kib} />{/if}
  <Panel {source} tabs="mobile" initialTab="moves" height="{panelH}px" flipped={view.flipped} />
</main>

<style>
  .tab {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 16px;
  }
  .top {
    display: flex;
    gap: 14px;
  }
  .board-row {
    display: flex;
    gap: 8px;
  }
  .side {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
  }
  .grp {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
</style>
