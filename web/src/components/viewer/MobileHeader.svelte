<script lang="ts">
  import BrandMark from '../BrandMark.svelte';
  import Icon from './Icon.svelte';
  import { gameText, getView } from '$lib/view.svelte';
  import type { HeaderInfo } from '$lib/view.svelte';

  type Props = { info: HeaderInfo };
  const { info }: Props = $props();

  const view = getView();
  // "Game N · M watching"; archives and replays have no watching count.
  const sub = $derived([gameText(info), info.archive ? '' : `${info.watching} watching`].filter(Boolean).join(' · '));
</script>

<!-- Lichess2Mobile.dc.html header. The ≡ More options menu lives in MobileNavBar. -->
<header>
  <a href="/" aria-label="CCRL Live — all broadcasts" class="brand"><BrandMark /></a>
  <div class="titles">
    <span class="site">{info.site}</span>
    <span class="sub">
      {#if info.archive}<span class="badge">ARCHIVE</span>{:else}<span class="badge live"
          ><span class="dot"></span>LIVE</span
        >{/if}
      {#if sub}<span class="txt">{sub}</span>{/if}
    </span>
  </div>
  <button type="button" class="icon" aria-label="Flip board" aria-pressed={view.flipped} onclick={view.toggleFlip}>
    <Icon name="flip" size={20} />
  </button>
</header>

<style>
  header {
    flex-shrink: 0;
    height: 52px;
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 0 4px 0 8px; /* 8 + (44 - 24) / 2 = the artboard's 18 px to the mark */
    border-bottom: 1px solid var(--line);
    background: var(--surface);
  }
  .brand {
    display: grid;
    place-items: center;
    width: 44px;
    height: 44px;
    flex-shrink: 0;
    color: var(--text);
  }
  .titles {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 1px;
  }
  .site {
    font-size: 14px;
    font-weight: 600;
    color: var(--text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .sub {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
    font-size: 12px;
    color: var(--muted);
    white-space: nowrap;
  }
  .badge {
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    height: 16px;
    padding: 0 5px;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.06em;
    background: var(--surface2);
    color: var(--muted);
  }
  .badge.live {
    background: var(--liveBg);
    /* Theme-invariant: text on the LIVE badge. */
    color: #ffffff;
  }
  .dot {
    width: 5px;
    height: 5px;
    background: currentColor;
  }
  .txt {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .icon {
    display: grid;
    place-items: center;
    width: 44px;
    height: 44px;
    flex-shrink: 0;
    padding: 0;
    border: 0;
    background: transparent;
    color: var(--muted);
  }
  .icon:hover {
    background: var(--surface2);
    color: var(--text);
  }
  .icon[aria-pressed='true'] {
    color: var(--text);
  }
</style>
