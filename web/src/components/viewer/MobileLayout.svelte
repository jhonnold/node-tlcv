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
  import MobileNavBar from './MobileNavBar.svelte';

  type Props = { source: ViewerSource };
  const { source }: Props = $props();

  const game = getGameStore();
  const view = getView();
  const kib = $derived(kibitzerView(game));
  const THUMB = 64; // PV-end board of the short cards (Lichess2Mobile.dc.html)

  let w = $state(0);
  // Full width. Landscape phones: no taller than the screen less the 52 px header and the 56 px nav bar.
  const size = $derived(floor8(Math.min(w, Math.max(280, (innerHeight.current ?? 0) - 108))));
</script>

<main class="mob" bind:clientWidth={w}>
  {#if game.engines}
    <div class="eng first">
      <EngineCard short thumb={THUMB} engine={game.engines[view.top]} flipped={view.flipped} />
    </div>
  {/if}
  {#if game.players}
    <div class="pbar"><PlayerBar compact side={view.top} {...game.players[view.top]} /></div>
  {/if}
  <div class="board-wrap">
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
  <EvalBar orientation="horizontal" thickness={6} bordered={false} score={game.evalScore} />
  {#if game.players}
    <div class="pbar"><PlayerBar compact side={view.bottom} {...game.players[view.bottom]} /></div>
  {/if}
  {#if game.engines}
    <div class="eng">
      <EngineCard short thumb={THUMB} engine={game.engines[view.bottom]} flipped={view.flipped} />
    </div>
  {/if}
  {#if kib}
    <div class="eng"><EngineCard short thumb={THUMB} engine={kib} flipped={view.flipped} /></div>
  {/if}
  <div class="panel">
    <!-- Fills the screen above the nav bar once scrolled to the end. -->
    <Panel {source} tabs="chatFirst" touch height="max(420px, calc(100svh - 56px))" bordered={false} />
  </div>
  <MobileNavBar />
</main>

<style>
  .mob {
    flex: 1;
    display: flex;
    flex-direction: column;
  }
  .eng {
    padding: 0 12px 8px;
  }
  .eng.first {
    padding: 8px 12px 0;
  }
  .pbar {
    padding: 8px 12px;
  }
  .board-wrap {
    display: flex;
    justify-content: center;
  }
  .panel {
    border-top: 1px solid var(--line);
  }
</style>
