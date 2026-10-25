<script lang="ts">
  import BrandMark from '../BrandMark.svelte';
  import Icon from './Icon.svelte';
  import { getView } from '$lib/view.svelte';
  import type { Breakpoint } from '$lib/view.svelte';
  import { sound, toggleSound } from '$lib/sounds.svelte';

  type Props = { bp: Breakpoint };
  const { bp }: Props = $props();

  const view = getView();
  const iconSize = $derived(bp === 'tablet' ? 20 : 18);
</script>

<!-- Lichess2.dc.html header: brand and view buttons only; site, game and LIVE/ARCHIVE are in the EventCard. -->
<header class="hdr {bp}">
  <a class="brand" href="/">
    <BrandMark />
    <span>CCRL Live</span>
  </a>
  <span class="spacer"></span>
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
  .spacer {
    flex: 1;
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
