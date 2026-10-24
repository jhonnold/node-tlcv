<script lang="ts">
  import { MediaQuery } from 'svelte/reactivity';
  import Board from './Board.svelte';
  import { BOARD_PALETTES } from '$lib/theme/presets';
  import { PIECE_SETS, isPieceSetId } from '$lib/theme/piece-sets';
  import { resetToPreset, setBoardPalette, setPieceSet, setPreset, theme } from '$lib/theme/theme.svelte';
  import {
    ADV_ROWS,
    ARROW_ROWS,
    BOARD_ROWS,
    PAGE_ROWS,
    PALETTE_IDS,
    PRESET_ITEMS,
    SAMPLE_FEN,
    SAMPLE_LAST_MOVE,
    editColor,
    rovingKeydown,
    sampleArrows,
    toInputHex,
  } from './theme/drawer';
  import type { ColorRow } from './theme/drawer';

  type Props = { open: boolean; onclose: () => void };
  const { open, onclose }: Props = $props();

  let dialog: HTMLDialogElement;
  let opener: HTMLElement | null = null;
  let mounted = $state(false); // preview Board is created on first open, then kept
  const narrow = new MediaQuery('(max-width: 767px)');
  const boardSize = $derived(narrow.current ? 128 : 164);
  const arrows = $derived(sampleArrows(theme.colors));

  $effect(() => {
    if (open && !dialog.open) {
      opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      mounted = true;
      dialog.showModal(); // focuses the first focusable (× button); background becomes inert
    } else if (!open && dialog.open) {
      dialog.close();
    }
  });

  // Fires for every close path, including native Esc. Keeps the parent's `open` in sync.
  function handleClose(): void {
    if (open) onclose();
    opener?.focus();
    opener = null;
  }

  // The dialog box is fully covered by .sheet, so a target of the dialog itself means ::backdrop.
  // Both press and release must be on the scrim: a drag from inside the sheet onto the scrim also fires a click on the dialog.
  let downOnScrim = false; // press must also start on ::backdrop
  function handleClick(e: MouseEvent): void {
    if (downOnScrim && e.target === dialog) onclose();
  }

  function pickPiece(e: Event & { currentTarget: HTMLSelectElement }): void {
    const v = e.currentTarget.value;
    if (isPieceSetId(v)) setPieceSet(v);
  }
</script>

{#snippet rows(list: ColorRow[])}
  <ul class="rows">
    {#each list as r (r.key)}
      <li>
        <label for="t-{r.key}">{r.label}</label>
        <span class="hex mono">{theme.colors[r.key].toUpperCase()}</span>
        <input
          id="t-{r.key}"
          type="color"
          value={toInputHex(theme.colors[r.key])}
          oninput={(e) => editColor(r.key, e.currentTarget.value)}
        />
      </li>
    {/each}
  </ul>
{/snippet}

<!-- keydown is stopped so keys pressed in the drawer never reach window handlers (game navigation). -->
<dialog
  bind:this={dialog}
  aria-labelledby="theme-title"
  onclose={handleClose}
  onclick={handleClick}
  onpointerdown={(e) => (downOnScrim = e.target === dialog)}
  onkeydown={(e) => e.stopPropagation()}
>
  <div class="sheet">
    <div class="head">
      <h2 id="theme-title">Theme</h2>
      <button type="button" class="icon" aria-label="Close theme settings" onclick={onclose}>
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg
        >
      </button>
    </div>
    <div class="body">
      <div class="presets" role="radiogroup" aria-label="Preset">
        {#each PRESET_ITEMS as p, i (p.id)}
          <button
            type="button"
            role="radio"
            aria-checked={theme.name === p.id}
            tabindex={theme.name === p.id ? 0 : -1}
            onclick={() => setPreset(p.id)}
            onkeydown={(e) => rovingKeydown(e, i, PRESET_ITEMS.length, (j) => setPreset(PRESET_ITEMS[j].id))}
            >{p.label}</button
          >
        {/each}
      </div>

      <section aria-labelledby="theme-board-h">
        <h3 id="theme-board-h">Board</h3>
        <div class="board-row">
          {#if mounted}
            <Board
              fen={SAMPLE_FEN}
              size={boardSize}
              coords={false}
              lastMove={SAMPLE_LAST_MOVE}
              {arrows}
              animate={false}
              label="Board preview"
            />
          {/if}
          <div class="board-ctl">
            <div class="field">
              <label for="piece-set">Pieces</label>
              <select id="piece-set" onchange={pickPiece}>
                {#each PIECE_SETS as s (s.id)}<option value={s.id} selected={theme.pieceSet === s.id}>{s.label}</option
                  >{/each}
              </select>
            </div>
            <div class="field">
              <span id="squares-label">Squares</span>
              <div class="swatches" role="radiogroup" aria-labelledby="squares-label">
                {#each PALETTE_IDS as id, i (id)}
                  {@const p = BOARD_PALETTES[id]}
                  <button
                    type="button"
                    role="radio"
                    aria-checked={theme.palette === id}
                    tabindex={theme.palette === id ? 0 : -1}
                    aria-label="{p.label} squares"
                    title="{p.label} squares"
                    style:background="linear-gradient(135deg, {p.colors.boardLight} 50%, {p.colors.boardDark} 50%)"
                    onclick={() => setBoardPalette(id)}
                    onkeydown={(e) => rovingKeydown(e, i, PALETTE_IDS.length, (j) => setBoardPalette(PALETTE_IDS[j]))}
                  ></button>
                {/each}
              </div>
            </div>
          </div>
        </div>
        {@render rows(BOARD_ROWS)}
        <details>
          <summary>Arrow colors</summary>
          {@render rows(ARROW_ROWS)}
        </details>
      </section>

      <section aria-labelledby="theme-page-h">
        <h3 id="theme-page-h">Page</h3>
        {@render rows(PAGE_ROWS)}
        <p class="note">
          Hover and border shades are derived from these automatically. Editing any color switches the preset to Custom.
        </p>
        <details>
          <summary>Graph and eval bar colors</summary>
          {@render rows(ADV_ROWS)}
        </details>
      </section>
    </div>
    <div class="foot">
      <button type="button" class="reset" onclick={resetToPreset}>Reset to preset</button>
      <button type="button" class="done" onclick={onclose}>Done</button>
    </div>
  </div>
</dialog>

<style>
  /* Allowed :global exception: while the modal is open the page behind must not scroll (dialog doesn't lock it). */
  :global(html:has(dialog[open])) {
    overflow: hidden;
  }
  dialog {
    margin: 0 0 0 auto;
    padding: 0;
    border: 0;
    border-left: 1px solid var(--line);
    width: 440px;
    max-width: 100%;
    height: 100dvh;
    max-height: 100dvh;
    overflow: hidden;
    background: var(--surface);
    color: var(--text);
    font-family: var(--fontUi);
    transform: translateX(100%);
    transition:
      transform 200ms ease-out,
      overlay 200ms allow-discrete,
      display 200ms allow-discrete;
  }
  dialog[open] {
    transform: none;
  }
  @starting-style {
    dialog[open] {
      transform: translateX(100%);
    }
  }
  dialog::backdrop {
    background: rgb(0 0 0 / 0);
    transition:
      background-color 200ms,
      overlay 200ms allow-discrete,
      display 200ms allow-discrete;
  }
  dialog[open]::backdrop {
    background: rgb(0 0 0 / 0.5);
  }
  @starting-style {
    dialog[open]::backdrop {
      background: rgb(0 0 0 / 0);
    }
  }
  .sheet {
    height: 100%;
    display: flex;
    flex-direction: column;
  }
  .head {
    height: 60px;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 0 12px 0 20px;
    border-bottom: 1px solid var(--line);
  }
  h2 {
    flex: 1;
    font-size: 17px;
    font-weight: 600;
  }
  .icon {
    width: 44px;
    height: 44px;
    display: grid;
    place-items: center;
    border: 0;
    background: transparent;
    color: var(--muted);
  }
  .icon:hover {
    color: var(--text);
  }
  .body {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 26px;
    padding: 20px;
  }
  .presets {
    display: flex;
    gap: 4px;
    padding: 3px;
    background: var(--surface2);
  }
  .presets button {
    flex: 1;
    height: 40px;
    border: 0;
    background: transparent;
    color: var(--muted);
    font-size: 14px;
    font-weight: 600;
  }
  .presets button[aria-checked='true'] {
    background: var(--text);
    color: var(--bg);
  }
  section {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  h3 {
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--muted);
  }
  .board-row {
    display: flex;
    gap: 16px;
    align-items: flex-start;
  }
  .board-ctl {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .field {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .field > label,
  .field > span {
    font-size: 13px;
    color: var(--muted);
  }
  select {
    height: 40px;
    padding: 0 10px;
    border: 1px solid var(--line);
    background: var(--surface2);
    color: var(--text);
    font-size: 14px;
  }
  .swatches {
    display: flex;
    gap: 8px;
  }
  .swatches button {
    width: 44px;
    height: 44px;
    padding: 0;
    border: 2px solid var(--line);
  }
  .swatches button[aria-checked='true'] {
    border-color: var(--text);
  }
  .rows {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .rows li {
    height: 48px;
    display: flex;
    align-items: center;
    gap: 12px;
    border-bottom: 1px solid var(--line2);
  }
  .rows label {
    flex: 1;
    font-size: 14px;
  }
  .hex {
    font-size: 12px;
    color: var(--muted);
  }
  input[type='color'] {
    width: 44px;
    height: 32px;
    padding: 0;
    border: 1px solid var(--line);
    background: transparent;
  }
  input[type='color']::-webkit-color-swatch-wrapper {
    padding: 0;
  }
  input[type='color']::-webkit-color-swatch,
  input[type='color']::-moz-color-swatch {
    border: 0;
  }
  .note {
    font-size: 12px;
    line-height: 1.5;
    color: var(--muted);
  }
  summary {
    min-height: 44px;
    display: flex;
    align-items: center;
    font-size: 13px;
    font-weight: 600;
    color: var(--muted);
    cursor: pointer;
    list-style: none;
  }
  summary::-webkit-details-marker {
    display: none;
  }
  .foot {
    flex-shrink: 0;
    display: flex;
    gap: 10px;
    padding: 14px 20px;
    border-top: 1px solid var(--line);
  }
  .reset,
  .done {
    flex: 1;
    height: 44px;
    font-size: 14px;
  }
  .reset {
    border: 1px solid var(--line);
    background: transparent;
    color: var(--text);
    font-weight: 600;
  }
  .done {
    border: 0;
    background: var(--invBg);
    color: var(--invText);
    font-weight: 700;
  }
  @media (max-width: 767px) {
    dialog {
      width: 100%;
      border-left: 0;
      transform: translateY(100%);
    }
    @starting-style {
      dialog[open] {
        transform: translateY(100%);
      }
    }
    .presets button,
    select,
    input[type='color'] {
      height: 44px;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    dialog,
    dialog::backdrop {
      transition: none;
    }
  }
</style>
