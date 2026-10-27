<script lang="ts">
  import { MediaQuery } from 'svelte/reactivity';
  import type { XRow } from '$lib/standings';
  import StandingsTable from './StandingsTable.svelte';

  type Props = { rows: XRow[]; totalGames: number | null; open: boolean; onclose: () => void };
  const { rows, totalGames, open, onclose }: Props = $props();

  let dialog: HTMLDialogElement;
  let opener: HTMLElement | null = null;
  const narrow = new MediaQuery('(max-width: 767px)');

  $effect(() => {
    if (open && !dialog.open) {
      opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      dialog.showModal();
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

  // The sheet covers the whole dialog box, so a target of the dialog itself means the backdrop.
  // Close only when press and release both land there.
  let downOnScrim = false;
  let upOnScrim = false;
  function handleClick(e: MouseEvent): void {
    if (downOnScrim && upOnScrim && e.target === dialog) onclose();
  }
</script>

<dialog
  bind:this={dialog}
  class:narrow={narrow.current}
  aria-labelledby="standings-dialog-title"
  onclose={handleClose}
  onclick={handleClick}
  onpointerdown={(e) => (downOnScrim = e.target === dialog)}
  onpointerup={(e) => (upOnScrim = e.target === dialog)}
>
  <div class="sheet">
    <div class="head">
      <div class="titles">
        <h2 id="standings-dialog-title">Standings</h2>
        {#if totalGames != null}
          <span class="sub">{totalGames} games played</span>
        {/if}
      </div>
      <button type="button" class="icon" aria-label="Close standings" title="Close (Esc)" onclick={onclose}>
        <svg
          width="16"
          height="16"
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
      {#if open}
        <StandingsTable {rows} wide={true} />
      {/if}
    </div>
  </div>
</dialog>

<style>
  dialog {
    width: min(1100px, calc(100vw - 32px));
    height: min(780px, calc(100vh - 32px));
    max-width: none;
    max-height: none;
    padding: 0;
    border: 1px solid var(--line);
    background: var(--surface);
    color: var(--text);
    font-family: var(--fontUi);
  }
  dialog.narrow {
    width: 100vw;
    height: 100vh;
    height: 100dvh;
    border: 0;
  }
  dialog::backdrop {
    background: rgba(0, 0, 0, 0.55);
  }
  .sheet {
    height: 100%;
    display: flex;
    flex-direction: column;
  }
  .head {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px 14px 14px 20px;
    border-bottom: 1px solid var(--line);
  }
  .narrow .head {
    padding: 8px 8px 8px 16px;
  }
  .titles {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  h2 {
    margin: 0;
    font-size: 17px;
    font-weight: 600;
  }
  .sub {
    font-size: 12px;
    color: var(--muted);
  }
  .icon {
    width: var(--pIconBtn, 36px);
    height: var(--pIconBtn, 36px);
    flex-shrink: 0;
    display: grid;
    place-items: center;
    border: 1px solid var(--line);
    background: transparent;
    color: var(--text);
  }
  .body {
    flex: 1;
    min-height: 0;
    overflow: auto;
    padding: 16px 20px 20px;
  }
  .narrow .body {
    padding: 0;
  }
</style>
