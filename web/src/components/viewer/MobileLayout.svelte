<script lang="ts">
  import { innerHeight } from 'svelte/reactivity/window';
  import { getGameStore } from '$lib/game.svelte';
  import { floor8, getView } from '$lib/view.svelte';
  import type { Side } from '$lib/view.svelte';
  import type { ViewerSource } from '$lib/url';
  import Board from '../Board.svelte';
  import EvalBar from '../EvalBar.svelte';
  import PlayerBar from '../PlayerBar.svelte';
  import Panel from '../panel/Panel.svelte';
  import NavControls from './NavControls.svelte';

  type Props = { source: ViewerSource };
  const { source }: Props = $props();

  const game = getGameStore();
  const view = getView();
  const top = $derived<Side>(view.flipped ? 'white' : 'black');
  const bottom = $derived<Side>(view.flipped ? 'black' : 'white');

  let w = $state(0);
  // The second term keeps landscape phones from getting a board taller than the screen.
  const size = $derived(floor8(Math.min(w, Math.max(280, (innerHeight.current ?? 0) - 56))));
</script>

<main class="mob" bind:clientWidth={w}>
  {#if game.players}
    <div class="pbar"><PlayerBar compact showScore side={top} {...game.players[top]} /></div>
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
    <div class="pbar"><PlayerBar compact showScore side={bottom} {...game.players[bottom]} /></div>
  {/if}
  <NavControls variant="mobile" />
  <div class="panel">
    <Panel {source} tabs="mobile" initialTab="engines" height="640px" bordered={false} flipped={view.flipped} />
  </div>
</main>

<style>
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
