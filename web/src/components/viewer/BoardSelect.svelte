<script module lang="ts">
  // Picking a board remounts the Viewer. After a keyboard pick the new picker takes focus back, so the arrow keys
  // keep stepping through boards; after a mouse pick focus stays on the page, so they step through moves.
  let refocus = false;
</script>

<script lang="ts">
  import { getGameStore } from '$lib/game.svelte';
  import { navigate } from '$lib/router.svelte';
  import { pagePath } from '$lib/url';

  type Props = { port: number; touch?: boolean };
  const { port, touch = false }: Props = $props();

  const game = getGameStore();
  const live = $derived(game.live);
  let keyed = false; // the last interaction with the picker was a key, not a pointer

  function onKey(): void {
    keyed = true;
  }
  function onPointer(): void {
    keyed = false;
  }
  function pick(e: Event & { currentTarget: HTMLSelectElement }): void {
    refocus = keyed;
    navigate(pagePath({ kind: 'live', port, board: Number(e.currentTarget.value) }));
  }
  function restoreFocus(el: HTMLSelectElement): void {
    if (!refocus) return;
    refocus = false;
    el.focus();
  }
</script>

<!-- TLCS-MG board picker; hidden on single-board broadcasts and archives. The selected board is the one joined
     (live.board); Viewer moves the URL to it when the server fell back to board 1. -->
{#if live && live.boards.length > 1}
  <select
    class:touch
    aria-label="Board"
    onchange={pick}
    onkeydown={onKey}
    onpointerdown={onPointer}
    {@attach restoreFocus}
  >
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
