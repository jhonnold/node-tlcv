<script lang="ts">
  import { getGameStore } from '$lib/game.svelte';

  type Props = { touch?: boolean };
  const { touch = false }: Props = $props();

  const game = getGameStore();
  const live = $derived(game.live);

  function pick(e: Event & { currentTarget: HTMLSelectElement }): void {
    game.switchBoard(Number(e.currentTarget.value));
  }
</script>

<!-- TLCS-MG board picker; hidden on single-board broadcasts and archives. The selected board is the one joined
     (live.board). A pick switches this socket to that board in place (GameStore.switchBoard). -->
{#if live && live.boards.length > 1}
  <select class:touch aria-label="Board" onchange={pick}>
    {#each live.boards as b (b)}<option value={b} selected={b === live.board}>Board {b}</option>{/each}
  </select>
{/if}

<style>
  select {
    flex-shrink: 0;
    height: 40px;
    padding: 0 8px;
    border: 1px solid var(--line);
    background: var(--surface2);
    color: var(--text);
    font-size: 14px;
  }
  select.touch {
    height: 44px;
  }
</style>
