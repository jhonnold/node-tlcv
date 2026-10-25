<script lang="ts">
  import { getGameStore } from '$lib/game.svelte';
  import Icon from './Icon.svelte';

  type Props = { variant: 'desktop' | 'tablet' };
  const { variant }: Props = $props();

  const game = getGameStore();
  const iconSize = $derived(variant === 'desktop' ? 18 : 20);
  // Live controls only on a live broadcast: an archive page with no game loaded (or a failed load) shows none.
  const liveUi = $derived(game.live != null && !game.isReplay);
</script>

<!-- Lichess2.dc.html table column: four equal buttons over a position / live status row. -->
<div class="block {variant}">
  <div class="grid4" role="group" aria-label="Move navigation">
    <button type="button" aria-label="Start position" title="Start (↑)" onclick={game.first}>
      <Icon name="first" size={iconSize} />
    </button>
    <button type="button" aria-label="Previous move" title="Previous (←)" onclick={game.prev}>
      <Icon name="prev" size={iconSize} />
    </button>
    <button type="button" aria-label="Next move" title="Next (→)" onclick={game.next}>
      <Icon name="next" size={iconSize} />
    </button>
    <button type="button" aria-label="Latest position" title="Latest (↓)" onclick={game.latest}>
      <Icon name="last" size={iconSize} />
    </button>
  </div>
  <div class="status">
    <span class="pos-label">{game.label}</span>
    {#if liveUi}
      {#if game.following}
        <span class="following"><span class="live-dot"></span>Following live</span>
      {:else}
        <button type="button" class="back" onclick={game.latest}>Back to live</button>
      {/if}
    {/if}
  </div>
</div>

<style>
  .live-dot {
    width: 6px;
    height: 6px;
    background: var(--liveText);
  }
  /* Desktop / tablet block: 66 px tall on desktop, 78 px on tablet (DesktopLayout's NAV). */
  .block {
    --navH: 40px;
    --rowH: 20px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-width: 0;
  }
  .block.tablet {
    --navH: 44px;
    --rowH: 44px; /* the Back to live button is a 44px touch target */
  }
  .grid4 {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 4px;
  }
  .grid4 button {
    height: var(--navH);
    display: grid;
    place-items: center;
    border: 1px solid var(--line);
    background: var(--surface);
    color: var(--text);
    padding: 0;
  }
  .status {
    height: var(--rowH);
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }
  .pos-label {
    flex: 1;
    min-width: 0;
    font-family: var(--fontMono);
    font-size: 12px;
    color: var(--muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .following {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
    font-size: 12px;
    font-weight: 600;
    color: var(--muted);
    white-space: nowrap;
  }
  .back {
    height: var(--rowH);
    flex-shrink: 0;
    padding: 0 8px;
    border: 0;
    background: var(--invBg);
    color: var(--invText);
    font-size: 11px;
    font-weight: 700;
    white-space: nowrap;
  }
  .tablet .back {
    padding: 0 12px;
    font-size: 12px;
  }
</style>
