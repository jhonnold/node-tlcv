<script lang="ts">
  import { getGameStore } from '$lib/game.svelte';
  import { DASH } from '$lib/format';
  import { splitOpening } from '$lib/moves';

  type Props = { variant: 'row' | 'short' };
  const { variant }: Props = $props();

  const game = getGameStore();
  const opening = $derived(splitOpening(game.game?.opening ?? ''));
  const tb = $derived(game.game?.tablebase || DASH);
  const hasOpening = $derived(opening.name !== '' || opening.eco !== '');
  const ecoGap = $derived(opening.eco ? ' ' : '');
</script>

{#snippet name()}
  {#if hasOpening}
    <span class="opening"
      >{#if opening.eco}<b>{opening.eco}</b>{ecoGap}{/if}{opening.name}</span
    >
  {/if}
{/snippet}

{#if variant === 'row'}
  <div class="line row">
    {@render name()}
    <span>Tablebase: {tb}</span>
  </div>
{:else}
  <span class="line">{@render name()}</span>
{/if}

<style>
  .line {
    font-size: 13px;
    color: var(--muted);
    white-space: nowrap;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  /* The short line gives way before the nav label; the row variant keeps its size under the board. */
  .line:not(.row) {
    flex-shrink: 1000;
  }
  .row {
    display: flex;
    gap: 16px;
  }
  .opening {
    overflow: hidden;
    text-overflow: ellipsis;
  }
  b {
    color: var(--text);
    font-weight: 600;
  }
</style>
