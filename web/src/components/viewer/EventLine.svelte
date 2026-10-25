<script lang="ts">
  import { gameText } from '$lib/view.svelte';
  import type { HeaderInfo } from '$lib/view.svelte';

  type Props = { info: HeaderInfo; tablet?: boolean };
  const { info, tablet = false }: Props = $props();

  // "Game N · M watching"; archives and replays have no watching count.
  const sub = $derived([gameText(info), info.archive ? '' : `${info.watching} watching`].filter(Boolean).join(' · '));
</script>

<!-- The header's second line (Lichess2Mobile, Lichess2 headerMeta): LIVE or ARCHIVE badge, then "Game N · M watching".
     Used by MobileHeader and by Header on tablet. -->
<span class="sub" class:tablet>
  {#if info.archive}<span class="badge">ARCHIVE</span>{:else}<span class="badge live"
      ><span class="dot"></span>LIVE</span
    >{/if}
  {#if sub}<span class="txt">{sub}</span>{/if}
</span>

<style>
  .sub {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
    font-size: 12px;
    color: var(--muted);
    white-space: nowrap;
  }
  .sub.tablet {
    gap: 8px;
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
</style>
