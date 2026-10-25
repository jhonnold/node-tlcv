<script lang="ts">
  import BrandMark from '../BrandMark.svelte';
  import EventLine from './EventLine.svelte';
  import Icon from './Icon.svelte';
  import { getView } from '$lib/view.svelte';
  import type { Breakpoint, HeaderInfo } from '$lib/view.svelte';
  import { sound, toggleSound } from '$lib/sounds.svelte';

  type Props = { bp: Breakpoint; info: HeaderInfo };
  const { bp, info }: Props = $props();

  const view = getView();
  const iconSize = $derived(bp === 'tablet' ? 20 : 18);
</script>

<!-- Lichess2.dc.html header. Desktop: brand and view buttons; site, game and LIVE/ARCHIVE are in the EventCard.
     Tablet (headerMeta): brand mark only, then the site over EventLine; there is no EventCard. -->
<header class="hdr {bp}">
  {#if bp === 'tablet'}
    <a class="brand" href="/" aria-label="CCRL Live — all broadcasts"><BrandMark /></a>
    <div class="titles">
      {#if info.site}<h1>{info.site}</h1>{/if}
      <EventLine {info} tablet />
    </div>
  {:else}
    <a class="brand" href="/">
      <BrandMark />
      <span>CCRL Live</span>
    </a>
    <span class="spacer"></span>
  {/if}
  <nav aria-label="View options">
    <button type="button" class="icon" aria-label="Focus mode" title="Focus mode" onclick={() => (view.focus = true)}>
      <Icon name="focus" size={iconSize} />
    </button>
    <button
      type="button"
      class="icon"
      aria-label="Flip board"
      title="Flip board"
      aria-pressed={view.flipped}
      onclick={view.toggleFlip}
    >
      <Icon name="flip" size={iconSize} />
    </button>
    <button
      type="button"
      class="icon"
      aria-label={sound.enabled ? 'Mute move sounds' : 'Unmute move sounds'}
      title="Move sounds"
      onclick={toggleSound}
    >
      <Icon name={sound.enabled ? 'sound' : 'mute'} size={iconSize} />
    </button>
    <button type="button" class="icon" aria-label="Theme" title="Theme" onclick={() => (view.themeOpen = true)}>
      <Icon name="palette" size={iconSize} />
    </button>
  </nav>
</header>

<style>
  .hdr {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    border-bottom: 1px solid var(--line);
    background: var(--surface);
    height: 56px;
    gap: 16px;
    padding: 0 20px;
  }
  .brand {
    display: flex;
    align-items: center;
    gap: 10px;
    color: var(--text);
    text-decoration: none;
    flex-shrink: 0;
    font-size: 16px;
    font-weight: 700;
  }
  /* A 44 px touch target; the negative margins keep the 24 px mark at the 20 px padding and 16 px from the titles. */
  .tablet .brand {
    justify-content: center;
    width: 44px;
    height: 44px;
    margin: 0 -10px;
  }
  .spacer {
    flex: 1;
  }
  .titles {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }
  h1 {
    font-size: 15px;
    font-weight: 600;
    line-height: 1.2;
    color: var(--text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  nav {
    display: flex;
    align-items: center;
    gap: 4px;
    flex-shrink: 0;
  }
  .tablet nav {
    gap: 2px;
  }
  .icon {
    display: grid;
    place-items: center;
    width: 40px;
    height: 40px;
    border: 0;
    background: transparent;
    color: var(--muted);
    padding: 0;
  }
  .tablet .icon {
    width: 44px;
    height: 44px;
  }
  .icon:hover {
    color: var(--text);
    background: var(--surface2);
  }
  .icon[aria-pressed='true'] {
    color: var(--text);
  }
</style>
