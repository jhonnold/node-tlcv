<script lang="ts">
  import { getGameStore } from '$lib/game.svelte';
  import { moveLabel } from '$lib/positions';
  import Icon from './Icon.svelte';

  type Props = { variant: 'desktop' | 'tablet' | 'mobile' };
  const { variant }: Props = $props();

  const game = getGameStore();
  const iconSize = $derived(variant === 'desktop' ? 18 : 20);
  // Mobile middle button: the move just played, or Start.
  const short = $derived(game.moveMeta ? moveLabel(game.moveMeta) : 'Start');
  // Live controls only on a live broadcast: an archive page with no game loaded (or a failed load) shows none.
  const liveUi = $derived(game.live != null && !game.isReplay);
  const behind = $derived(liveUi && !game.following);
  const midText = $derived(liveUi ? (game.following ? `Live · ${short}` : `${short} · back to live`) : short);
  const midLabel = $derived(
    liveUi
      ? game.following
        ? `Following live, after ${short}`
        : `Viewing ${short}, tap to return to live`
      : `Viewing ${short}, go to the last move`,
  );
</script>

{#if variant === 'mobile'}
  <div class="nav mobile">
    <div class="btns" role="group" aria-label="Move navigation">
      <button type="button" aria-label="Start position" title="Start (↑)" onclick={game.first}>
        <Icon name="first" size={iconSize} />
      </button>
      <button type="button" aria-label="Previous move" title="Previous (←)" onclick={game.prev}>
        <Icon name="prev" size={iconSize} />
      </button>
      <button type="button" class="mid" class:behind aria-label={midLabel} onclick={game.latest}>
        {#if liveUi && game.following}<span class="live-dot"></span>{/if}
        <span class="txt">{midText}</span>
      </button>
      <button type="button" aria-label="Next move" title="Next (→)" onclick={game.next}>
        <Icon name="next" size={iconSize} />
      </button>
      <button type="button" aria-label="Latest position" title="Latest (↓)" onclick={game.latest}>
        <Icon name="last" size={iconSize} />
      </button>
    </div>
  </div>
{:else}
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
{/if}

<style>
  /* Mobile row (MobileLayout); rules kept as they were. */
  .nav {
    display: flex;
    align-items: center;
    min-width: 0;
  }
  .nav.mobile {
    padding: 0 12px 12px;
  }
  .btns {
    display: flex;
    flex-shrink: 0;
    gap: 4px;
  }
  .btns button {
    display: grid;
    place-items: center;
    border: 1px solid var(--line);
    background: var(--surface);
    color: var(--text);
    padding: 0;
  }
  .mobile .btns {
    gap: 6px;
    flex: 1;
    min-width: 0;
  }
  .mobile .btns button {
    width: 48px;
    height: 44px;
  }
  .mid {
    flex: 1;
    min-width: 0;
    height: 44px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    border: 0;
    background: var(--surface2);
    color: var(--text);
    font-family: var(--fontMono);
    font-size: 13px;
    font-weight: 600;
    white-space: nowrap;
  }
  .mid.behind {
    background: var(--invBg);
    color: var(--invText);
  }
  .txt {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
  }
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
