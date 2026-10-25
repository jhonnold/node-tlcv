<script lang="ts">
  import { getGameStore } from '$lib/game.svelte';
  import { DASH } from '$lib/format';
  import { splitOpening } from '$lib/moves';
  import { gameText } from '$lib/view.svelte';
  import type { HeaderInfo } from '$lib/view.svelte';
  import Icon from './Icon.svelte';

  type Props = { info: HeaderInfo };
  const { info }: Props = $props();

  const game = getGameStore();
  const gt = $derived(gameText(info));
  const opening = $derived(splitOpening(game.game?.opening ?? ''));
  // "E06 Catalan, Closed · Tablebase: —" (ECO bold); no time control or "of M": the client doesn't know them.
  const rest = $derived([opening.name, `Tablebase: ${game.game?.tablebase || DASH}`].filter(Boolean).join(' · '));
  const ecoSep = $derived(opening.name ? ' ' : ' · ');
</script>

<!-- Lichess2.dc.html "meta" area. -->
<section class="event" aria-label="Event">
  <div class="mode">
    {#if info.archive}
      <span class="badge archive">ARCHIVE</span>
    {:else}
      <span class="badge live"><span class="dot"></span>LIVE</span>
      <span class="watching"><Icon name="eye" size={16} />{info.watching} watching</span>
    {/if}
  </div>
  {#if info.site}<h1>{info.site}</h1>{/if}
  {#if gt}<span class="line">{gt}</span>{/if}
  <span class="line"
    >{#if opening.eco}<b>{opening.eco}</b>{ecoSep}{/if}{rest}</span
  >
</section>

<style>
  .event {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 16px;
    border: 1px solid var(--line);
    background: var(--surface);
    color: var(--text);
    font-family: var(--fontUi);
  }
  .mode {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 24px;
  }
  .badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 24px;
    padding: 0 10px;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.08em;
    white-space: nowrap;
  }
  .badge.live {
    background: var(--liveBg);
    /* Theme-invariant: text on the LIVE badge. */
    color: #ffffff;
  }
  .badge.archive {
    background: var(--surface2);
    color: var(--muted);
  }
  .dot {
    display: inline-block;
    width: 6px;
    height: 6px;
    background: currentColor;
  }
  .watching {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    color: var(--muted);
    white-space: nowrap;
  }
  h1 {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    line-height: 1.3;
    overflow-wrap: anywhere;
  }
  .line {
    font-size: 13px;
    color: var(--muted);
    overflow-wrap: anywhere;
  }
  b {
    color: var(--text);
    font-weight: 600;
  }
</style>
