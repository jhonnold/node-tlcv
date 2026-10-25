<script lang="ts">
  import { gameText } from '$lib/view.svelte';
  import type { HeaderInfo } from '$lib/view.svelte';

  type Props = { info: HeaderInfo };
  const { info }: Props = $props();

  const parts = $derived([gameText(info), info.archive ? '' : `${info.watching} watching`].filter(Boolean));
</script>

<!-- Tablet / mobile header sub-line: LIVE or ARCHIVE, then "· Game N · M watching". -->
<span class="sub">
  {#if info.archive}<span class="mode">ARCHIVE</span>{:else}<span class="mode live"><span class="dot"></span>LIVE</span
    >{/if}
  {#each parts as p (p)}<span>· {p}</span>{/each}
</span>

<style>
  .sub {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: var(--muted);
    white-space: nowrap;
    overflow: hidden;
  }
  .mode {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.06em;
    color: var(--muted);
  }
  .mode.live {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    color: var(--liveText);
  }
  .dot {
    display: inline-block;
    width: 6px;
    height: 6px;
    background: currentColor;
  }
</style>
