<script lang="ts">
  import { getGameStore } from '$lib/game.svelte';
  import { splitOpening } from '$lib/moves';

  type Props = { variant: 'row' | 'inline' | 'short' };
  const { variant }: Props = $props();

  const game = getGameStore();
  const opening = $derived(splitOpening(game.game?.opening ?? ''));
  const tb = $derived(game.game?.tablebase || '—');
  const hasOpening = $derived(opening.name !== '' || opening.eco !== '');
  const sep = $derived(hasOpening ? ' · ' : '');
</script>

{#snippet name()}
  {#if hasOpening}
    <span class="opening"
      >{#if opening.eco}<b>{opening.eco}</b>
      {/if}{opening.name}</span
    >
  {/if}
{/snippet}

{#if variant === 'row'}
  <div class="line row">
    {@render name()}
    <span>Tablebase: {tb}</span>
  </div>
{:else if variant === 'inline'}
  <span class="line"
    >{#if hasOpening}{@render name()}{/if}{sep}Tablebase: {tb}</span
  >
{:else}
  <span class="line">{@render name()}</span>
{/if}

<style>
  .line {
    font-size: 13px;
    color: var(--muted);
    white-space: nowrap;
    min-width: 0;
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
