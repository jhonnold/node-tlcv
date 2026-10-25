<script lang="ts">
  import { tick } from 'svelte';
  import BrandMark from '../BrandMark.svelte';
  import Icon from './Icon.svelte';
  import ModeLine from './ModeLine.svelte';
  import { getView } from '$lib/view.svelte';
  import type { HeaderInfo } from '$lib/view.svelte';
  import { sound, toggleSound } from '$lib/sounds.svelte';

  type Props = { info: HeaderInfo };
  const { info }: Props = $props();

  const view = getView();

  let open = $state(false);
  let wrap: HTMLDivElement;
  let trigger: HTMLButtonElement;
  let menu = $state<HTMLDivElement>();
  const items = (): HTMLElement[] => (menu ? [...menu.querySelectorAll<HTMLElement>('[role^="menuitem"]')] : []);

  async function show(): Promise<void> {
    open = true;
    await tick();
    items()[0]?.focus();
  }
  function hide(refocus: boolean): void {
    open = false;
    if (refocus) trigger.focus();
  }
  function triggerKey(e: KeyboardEvent): void {
    if (e.key !== 'ArrowDown' || open) return;
    e.preventDefault();
    e.stopPropagation();
    void show();
  }
  // Roving focus (WAI-ARIA menu button). ↑/↓/Home/End/Esc stop here. ←/→ pass through to game.onKeydown (they always step
  // moves). Delegated keydown runs on #app before window, so stopPropagation keeps the window handler out.
  function menuKey(e: KeyboardEvent): void {
    if (e.key === 'Tab') return hide(false);
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      return hide(true);
    }
    const list = items();
    const n = list.length;
    const i = list.indexOf(document.activeElement as HTMLElement);
    const next = (
      { ArrowDown: (i + 1) % n, ArrowUp: i < 0 ? n - 1 : (i - 1 + n) % n, Home: 0, End: n - 1 } as Record<
        string,
        number
      >
    )[e.key];
    if (next === undefined) return;
    e.preventDefault();
    e.stopPropagation();
    list[next].focus();
  }
  function outside(e: PointerEvent): void {
    if (open && !wrap.contains(e.target as Node)) hide(false);
  }
</script>

<svelte:window onpointerdown={outside} />

<header>
  <a href="/" aria-label="CCRL Live — all broadcasts" class="brand">
    <BrandMark size={24} />
  </a>
  <div class="titles">
    <span class="site">{info.site}</span>
    <ModeLine {info} />
  </div>
  <button type="button" class="icon" aria-label="Flip board" aria-pressed={view.flipped} onclick={view.toggleFlip}>
    <Icon name="flip" size={20} />
  </button>
  <div class="more" bind:this={wrap}>
    <button
      bind:this={trigger}
      type="button"
      class="icon"
      class:open
      aria-label="More options"
      aria-haspopup="menu"
      aria-expanded={open}
      aria-controls={open ? 'viewer-menu' : undefined}
      onclick={() => {
        if (open) hide(false);
        else void show();
      }}
      onkeydown={triggerKey}
    >
      <Icon name="more" size={20} />
    </button>
    {#if open}
      <div bind:this={menu} id="viewer-menu" role="menu" aria-label="View options" tabindex="-1" onkeydown={menuKey}>
        <button
          type="button"
          role="menuitem"
          tabindex="-1"
          onclick={() => {
            hide(false);
            view.focus = true;
          }}
        >
          <Icon name="focus" size={18} /><span class="text">Focus mode</span>
        </button>
        <button type="button" role="menuitemcheckbox" tabindex="-1" aria-checked={sound.enabled} onclick={toggleSound}>
          <Icon name="soundSmall" size={18} /><span class="text">Move sounds</span>
          <span class="state">{sound.enabled ? 'On' : 'Off'}</span>
        </button>
        <button
          type="button"
          role="menuitem"
          tabindex="-1"
          onclick={() => {
            hide(true);
            view.themeOpen = true;
          }}
        >
          <Icon name="contrast" size={18} /><span class="text">Theme &amp; pieces</span>
        </button>
        <a role="menuitem" tabindex="-1" href="/" onclick={() => hide(false)}>
          <Icon name="grid" size={18} /><span class="text">All broadcasts</span>
        </a>
      </div>
    {/if}
  </div>
</header>

<style>
  header {
    flex-shrink: 0;
    height: 56px;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 0 4px 0 12px;
    border-bottom: 1px solid var(--line);
    background: var(--surface);
  }
  .brand {
    display: grid;
    place-items: center;
    width: 32px;
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
  .icon {
    display: grid;
    place-items: center;
    width: 44px;
    height: 44px;
    border: 0;
    background: transparent;
    color: var(--muted);
    padding: 0;
    flex-shrink: 0;
  }
  .icon:hover {
    color: var(--text);
    background: var(--surface2);
  }
  .icon[aria-pressed='true'] {
    color: var(--text);
  }
  .icon.open {
    background: var(--surface2);
  }
  .more {
    position: relative;
    flex-shrink: 0;
  }
  [role='menu'] {
    position: absolute;
    z-index: 5;
    top: calc(100% + 10px);
    right: 4px;
    width: 232px;
    padding: 6px;
    border: 1px solid var(--line);
    background: var(--surface);
  }
  [role^='menuitem'] {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    height: 44px;
    padding: 0 10px;
    border: 0;
    background: transparent;
    color: var(--text);
    font-size: 14px;
    text-align: left;
    text-decoration: none;
  }
  [role^='menuitem']:hover,
  [role^='menuitem']:focus {
    background: var(--surface2);
  }
  .text {
    flex: 1;
  }
  .state {
    font-size: 12px;
    color: var(--muted);
  }
</style>
