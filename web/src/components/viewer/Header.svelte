<script lang="ts">
  import BrandMark from '../BrandMark.svelte';
  import Icon from './Icon.svelte';
  import ModeLine from './ModeLine.svelte';
  import { getView, gameText } from '$lib/view.svelte';
  import type { Breakpoint, HeaderInfo } from '$lib/view.svelte';
  import { sound, toggleSound } from '$lib/sounds.svelte';

  type Props = { bp: Breakpoint; info: HeaderInfo };
  const { bp, info }: Props = $props();

  const view = getView();
  const iconSize = $derived(bp === 'tablet' ? 20 : 18);
  const gt = $derived(gameText(info));
</script>

<header class="hdr {bp}">
  <a class="brand" href="/">
    <BrandMark size={24} />
    <span>CCRL Live</span>
  </a>
  <span class="divider" aria-hidden="true"></span>
  <div class="titles">
    <span class="site">{info.site}</span>
    {#if bp === 'tablet'}
      <ModeLine {info} />
    {:else if gt}
      <span class="sub">{gt}</span>
    {/if}
  </div>
  {#if bp !== 'tablet'}
    {#if info.archive}
      <span class="badge archive">ARCHIVE</span>
    {:else}
      <span class="badge live"><span class="dot"></span>LIVE</span>
      <span class="watching"><Icon name="eye" size={16} />{info.watching} watching</span>
    {/if}
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
  .hdr.tablet {
    gap: 12px;
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
  .divider {
    width: 1px;
    height: 24px;
    background: var(--line);
    flex-shrink: 0;
  }
  .titles {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
  .tablet .titles {
    flex: 1;
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
    font-size: 12px;
    color: var(--muted);
    white-space: nowrap;
  }
  .dot {
    display: inline-block;
    width: 6px;
    height: 6px;
    background: currentColor;
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
    flex-shrink: 0;
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
  .watching {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    color: var(--muted);
    white-space: nowrap;
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
