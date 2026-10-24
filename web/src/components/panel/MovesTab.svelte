<script lang="ts">
  import { onDestroy } from 'svelte';
  import { getGameStore } from '$lib/game.svelte';
  import { copyFen } from '$lib/fen';
  import { ghostCell, moveRows, placeGhost, prettyResult, splitOpening } from '$lib/moves';
  import { getTournament } from '$lib/tournament.svelte';
  import { apiBase } from '$lib/url';
  import type { ViewerSource } from '$lib/url';
  import { colorName, otherColor } from '$shared/colors';

  type Props = { source: ViewerSource; scroller: HTMLElement | undefined };
  const { source, scroller }: Props = $props();
  const game = getGameStore();
  const tournament = getTournament();

  const rows = $derived(moveRows(game.moves));
  const ghost = $derived.by(() => {
    const g = game.game;
    if (game.isReplay || !g) return null;
    const last = game.moves[game.moves.length - 1];
    const mover = last ? otherColor(last.color) : g.liveData.color;
    return ghostCell(game.moves, g.liveData, game.clocks?.[colorName(mover)].thinkMs ?? null);
  });
  // Known limitation: the ghost stays after a game ends. The result never reaches the store (src/game-service.ts:537-547).
  const view = $derived(placeGhost(rows, ghost));
  const op = $derived(splitOpening(game.game?.opening ?? ''));
  const sub = $derived(
    [
      op.eco,
      game.isReplay && game.replayMeta ? `${Math.ceil(game.length / 2)} moves` : `${game.length} plies`,
      game.isReplay && game.replayMeta
        ? prettyResult(game.replayMeta.result)
        : `${game.game?.stm === 'b' ? 'Black' : 'White'} to move`,
    ]
      .filter(Boolean)
      .join(' · '),
  );
  const pgnHref = $derived.by(() => {
    if (game.isReplay) return tournament.games?.find((r) => r.gameNumber === game.replayNumber)?.pgnUrl ?? null;
    return source.kind === 'live' ? `${apiBase(source)}/pgn` : null;
  });
  const pgnName = $derived(`${game.game?.white.name ?? 'White'} vs ${game.game?.black.name ?? 'Black'}.pgn`);

  let copied = $state(false);
  let copiedTimer: ReturnType<typeof setTimeout> | undefined;
  onDestroy(() => clearTimeout(copiedTimer));
  async function copy(): Promise<void> {
    if (!(await copyFen(game.fen))) return;
    copied = true;
    clearTimeout(copiedTimer);
    copiedTimer = setTimeout(() => (copied = false), 1500);
  }

  // Keeps the active move in view (navigation/index.ts:90-110). scrollIntoView would scroll the page on mobile.
  let list = $state<HTMLElement>();
  let head = $state<HTMLElement>();
  $effect(() => {
    void game.index;
    void game.length;
    const sc = scroller;
    if (!sc || !list) return;
    if (game.following) {
      sc.scrollTop = sc.scrollHeight; // live: keep the newest move and the ghost in view
      return;
    }
    const act = list.querySelector<HTMLElement>('[aria-current="step"]');
    if (!act) {
      sc.scrollTop = 0;
      return;
    }
    const top = act.offsetTop; // offsetParent is .body (position: relative)
    const h = act.offsetHeight;
    const hh = head?.offsetHeight ?? 0;
    if (top - hh < sc.scrollTop || top + h > sc.scrollTop + sc.clientHeight)
      sc.scrollTop = top - hh - (sc.clientHeight - hh - h) / 2;
  });
</script>

<div class="moves-head" bind:this={head}>
  <div class="head-text">
    <div class="op-name">{op.name || '—'}</div>
    <div class="head-sub">{sub}</div>
  </div>
  <button type="button" class="icon" aria-label="Copy FEN" title="Copy FEN" onclick={copy}>
    {#if copied}
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"><polyline points="20 6 9 17 4 12"></polyline></svg
      >
    {:else}
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
        ><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path
          d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"
        ></path></svg
      >
    {/if}
  </button>
  {#if pgnHref}
    <a class="icon" href={pgnHref} download={pgnName} aria-label="Download PGN" title="Download PGN">
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
        ><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line
          x1="12"
          y1="15"
          x2="12"
          y2="3"
        ></line></svg
      >
    </a>
  {/if}
</div>

{#if view.length === 0}
  <p class="empty">No moves yet.</p>
{:else}
  <ol class="moves" aria-label="Move list" bind:this={list}>
    {#each view as row, i (i)}
      <li class="row">
        <span class="num">{row.num}.</span>
        {#each row.cells as c, j (j)}
          {#if c.kind === 'move'}
            <button
              type="button"
              class="cell"
              class:active={c.ply === game.index}
              aria-label={c.label}
              aria-current={c.ply === game.index ? 'step' : undefined}
              onclick={() => game.goTo(c.ply)}
            >
              <span class="top">
                <span class="san">{c.san}</span>
                <span class="score">{c.score}</span>
              </span>
              <span class="cell-sub">{c.sub}</span>
            </button>
          {:else if c.kind === 'ghost'}
            <span class="ghost">
              <span class="top">
                <span class="san" style:color={c.color === 'w' ? 'var(--engW)' : 'var(--engB)'}>{c.san}</span>
                <span class="score">{c.score}</span>
              </span>
              <span class="cell-sub">{c.sub}</span>
            </span>
          {:else}
            <span></span>
          {/if}
        {/each}
      </li>
    {/each}
  </ol>
{/if}

<style>
  .moves-head {
    position: sticky;
    top: 0;
    z-index: 1;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 10px 10px 14px;
    background: var(--surface);
    border-bottom: 1px solid var(--line);
  }
  .head-text {
    flex: 1;
    min-width: 0;
  }
  .op-name {
    font-size: 13px;
    font-weight: 600;
  }
  .head-sub {
    font-size: 12px;
    color: var(--muted);
  }
  .icon {
    width: var(--pIconBtn);
    height: var(--pIconBtn);
    box-sizing: border-box;
    flex-shrink: 0;
    display: grid;
    place-items: center;
    padding: 0;
    border: 1px solid var(--line);
    background: transparent;
    color: var(--muted);
    cursor: pointer;
  }
  .moves {
    list-style: none;
    margin: 0;
    padding: 4px 6px 8px;
  }
  .row {
    display: grid;
    grid-template-columns: 36px minmax(0, 1fr) minmax(0, 1fr);
    gap: 2px;
    align-items: stretch;
  }
  .num {
    padding-top: 8px;
    padding-right: 6px;
    font-family: var(--fontMono);
    font-size: 12px;
    color: var(--faint);
    text-align: right;
  }
  .cell {
    min-width: 0;
    min-height: var(--pRowH);
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 5px 8px;
    border: 0;
    background: transparent;
    color: var(--text);
    text-align: left;
    font-family: var(--fontMono);
    cursor: pointer;
  }
  .cell.active {
    background: var(--sel);
  }
  .ghost {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 5px 8px;
    border: 1px dashed var(--line);
    font-family: var(--fontMono);
  }
  .top {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 6px;
  }
  .san {
    font-size: 14px;
    font-weight: 600;
    white-space: nowrap;
  }
  .score {
    font-size: 11px;
    font-weight: 500;
    color: var(--muted);
    white-space: nowrap;
  }
  .cell-sub {
    font-size: 11px;
    color: var(--faint);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .empty {
    padding: 14px;
    color: var(--muted);
  }
</style>
