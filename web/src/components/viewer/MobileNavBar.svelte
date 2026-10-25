<script lang="ts">
  import { tick } from 'svelte';
  import { getGameStore } from '$lib/game.svelte';
  import { moveLabel } from '$lib/positions';
  import { sound, toggleSound } from '$lib/sounds.svelte';
  import { getView } from '$lib/view.svelte';
  import Icon from './Icon.svelte';

  const game = getGameStore();
  const view = getView();

  // Middle button: the move just played, or Start. Live wording only on a live broadcast outside a replay.
  const short = $derived(game.moveMeta ? moveLabel(game.moveMeta) : 'Start');
  const liveUi = $derived(game.live != null && !game.isReplay);
  const behind = $derived(liveUi && !game.following);
  const midText = $derived(liveUi ? (game.following ? `Live · ${short}` : `${short} · live`) : short);
  const midLabel = $derived(
    liveUi
      ? game.following
        ? `Following live, after ${short}`
        : `Viewing ${short}, tap to return to live`
      : `Viewing ${short}, go to the last move`,
  );

  // ≡ "More options" menu (WAI-ARIA menu button), opening upward from the bar.
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
  // Roving focus. ↑/↓/Home/End/Esc stop here. ←/→ pass through to game.onKeydown (they always step moves).
  // Delegated keydown runs on #app before window, so stopPropagation keeps the window handler out.
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

<!-- Lichess2Mobile.dc.html bottom bar: sticky, 56 px. -->
<div class="navbar">
  <div class="menu-wrap" bind:this={wrap}>
    <button
      bind:this={trigger}
      type="button"
      class="icon menu-btn"
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
      <Icon name="menu" size={20} />
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
            hide(true); // A5: refocus the menu button first, so the drawer returns focus there
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
  <div class="btns" role="group" aria-label="Move navigation">
    <button type="button" class="icon" aria-label="Start position" onclick={game.first}>
      <Icon name="first" size={20} />
    </button>
    <button type="button" class="icon" aria-label="Previous move" onclick={game.prev}>
      <Icon name="prev" size={20} />
    </button>
    <button type="button" class="mid" class:behind aria-label={midLabel} onclick={game.latest}>
      {#if liveUi && game.following}<span class="live-dot"></span>{/if}
      <span class="txt">{midText}</span>
    </button>
    <button type="button" class="icon" aria-label="Next move" onclick={game.next}>
      <Icon name="next" size={20} />
    </button>
    <button type="button" class="icon" aria-label="Latest position" onclick={game.latest}>
      <Icon name="last" size={20} />
    </button>
  </div>
</div>

<style>
  .navbar {
    position: sticky;
    bottom: 0;
    z-index: 4;
    flex-shrink: 0;
    height: 56px;
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 0 8px;
    border-top: 1px solid var(--line);
    background: var(--surface);
  }
  .menu-wrap {
    position: relative;
    flex-shrink: 0;
  }
  .btns {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 4px;
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
    color: var(--text);
  }
  .icon:hover {
    background: var(--surface2);
  }
  .menu-btn {
    color: var(--muted);
  }
  .menu-btn.open {
    background: var(--surface2);
  }
  .mid {
    flex: 1;
    min-width: 0;
    height: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 0 8px;
    border: 0;
    background: var(--surface2);
    color: var(--text);
    font-family: var(--fontMono);
    font-size: 12px;
    font-weight: 600;
    white-space: nowrap;
  }
  .mid.behind {
    background: var(--invBg);
    color: var(--invText);
  }
  .live-dot {
    width: 6px;
    height: 6px;
    flex-shrink: 0;
    background: var(--liveText);
  }
  .txt {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  [role='menu'] {
    position: absolute;
    z-index: 5;
    bottom: calc(100% + 10px); /* opens upward: 4 px above the bar, as in the artboard */
    left: 0;
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
