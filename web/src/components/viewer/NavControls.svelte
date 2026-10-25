<script lang="ts">
  import { getGameStore } from '$lib/game.svelte';
  import { moveLabel } from '$lib/positions';
  import Icon from './Icon.svelte';
  import OpeningLine from './OpeningLine.svelte';

  type Props = { variant: 'desktop' | 'large' | 'tablet' | 'mobile' };
  const { variant }: Props = $props();

  const game = getGameStore();
  const iconSize = $derived(variant === 'tablet' || variant === 'mobile' ? 20 : 18);
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

<div class="nav {variant}">
  <div class="btns" role="group" aria-label="Move navigation">
    <button type="button" aria-label="Start position" title="Start (↑)" onclick={game.first}>
      <Icon name="first" size={iconSize} />
    </button>
    <button type="button" aria-label="Previous move" title="Previous (←)" onclick={game.prev}>
      <Icon name="prev" size={iconSize} />
    </button>
    {#if variant === 'mobile'}
      <button type="button" class="mid" class:behind aria-label={midLabel} onclick={game.latest}>
        {#if liveUi && game.following}<span class="live-dot"></span>{/if}
        <span class="txt">{midText}</span>
      </button>
    {/if}
    <button type="button" aria-label="Next move" title="Next (→)" onclick={game.next}>
      <Icon name="next" size={iconSize} />
    </button>
    <button type="button" aria-label="Latest position" title="Latest (↓)" onclick={game.latest}>
      <Icon name="last" size={iconSize} />
    </button>
  </div>

  {#if variant !== 'mobile'}
    <span class="pos-label">{game.label}</span>
    {#if liveUi}
      {#if game.following}
        {#if variant === 'desktop'}
          <span class="following"><span class="live-dot"></span>Following live</span>
        {/if}
      {:else}
        <button type="button" class="back" onclick={game.latest}>Back to live</button>
      {/if}
    {/if}
    {#if variant === 'large'}
      <span class="spacer"></span>
      <OpeningLine variant="inline" />
    {:else if variant === 'tablet'}
      <OpeningLine variant="short" />
    {/if}
  {/if}
</div>

<style>
  .nav {
    display: flex;
    align-items: center;
    min-width: 0;
  }
  .nav.desktop,
  .nav.large {
    gap: 12px;
    margin-top: 6px;
  }
  .nav.tablet {
    gap: 10px;
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
  .desktop .btns button {
    width: 40px;
    height: 36px;
  }
  .large .btns button {
    width: 44px;
    height: 38px;
  }
  .tablet .btns,
  .mobile .btns {
    gap: 6px;
  }
  .tablet .btns button,
  .mobile .btns button {
    width: 48px;
    height: 44px;
  }
  .mobile .btns {
    flex: 1;
    min-width: 0;
  }
  .pos-label {
    flex: 0 0 auto;
    font-family: var(--fontMono);
    font-size: 13px;
    color: var(--muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    min-width: 0;
  }
  .desktop .pos-label,
  .tablet .pos-label {
    flex: 1 0 auto;
  }
  .following {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    font-weight: 600;
    color: var(--muted);
    white-space: nowrap;
  }
  .live-dot {
    width: 6px;
    height: 6px;
    background: var(--liveText);
  }
  .back {
    height: 32px;
    flex-shrink: 0;
    padding: 0 12px;
    border: 0;
    background: var(--invBg);
    color: var(--invText);
    font-size: 12px;
    font-weight: 700;
    white-space: nowrap;
  }
  .tablet .back {
    height: 44px;
    padding: 0 16px;
    font-size: 13px;
  }
  .spacer {
    flex: 1;
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
</style>
