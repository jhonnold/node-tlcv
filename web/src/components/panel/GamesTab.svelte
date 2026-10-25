<script lang="ts">
  import { onMount } from 'svelte';
  import { getGameStore } from '$lib/game.svelte';
  import { gameRows } from '$lib/games';
  import { prettyResult } from '$lib/moves';
  import { getTournament } from '$lib/tournament.svelte';
  import type { ViewerSource } from '$lib/url';

  type Props = {
    source: ViewerSource;
    busy: number | null;
    err: string;
    onReplay: (n: number) => void;
    onWatch: () => void;
  };
  const { source, busy, err, onReplay, onWatch }: Props = $props();
  const game = getGameStore();
  const tournament = getTournament();
  const uid = $props.id();

  let query = $state('');
  let decisive = $state(false);

  onMount(() => void tournament.refresh());
  // Strings, so the rows aren't rebuilt on every delta (game.live changes each time).
  const liveWhite = $derived(game.live?.game.white.name ?? null);
  const liveBlack = $derived(game.live?.game.black.name ?? null);
  const rows = $derived(
    gameRows(
      tournament.games,
      source.kind === 'live' && liveWhite != null && liveBlack != null
        ? { number: tournament.currentGameNumber, white: liveWhite, black: liveBlack }
        : null,
      query,
      decisive,
    ),
  );
</script>

<div class="filter">
  <label for="{uid}-filter" class="sr-only">Filter by engine</label>
  <div class="search">
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg
    >
    <input id="{uid}-filter" type="search" placeholder="Filter by engine…" bind:value={query} />
  </div>
  <label class="check">
    <input type="checkbox" bind:checked={decisive} />
    Decisive only
  </label>
</div>

{#if err}<p class="muted err">{err}</p>{/if}

{#if rows.length === 0}
  <p class="muted">{query || decisive ? 'No games match your filter.' : 'No games yet.'}</p>
{:else}
  <ul class="games" aria-label="Games">
    {#each rows as r (r.key)}
      <li class:current={!r.live && game.replayNumber === r.num}>
        <span class="num">{r.num}</span>
        <div class="names">
          <span class="name" class:win={r.result === '1-0'}>
            <span class="disc white" aria-hidden="true"></span>{r.white}
          </span>
          <span class="name" class:win={r.result === '0-1'}>
            <span class="disc black" aria-hidden="true"></span>{r.black}
          </span>
        </div>
        <span class="res" class:live={r.live}>{r.live ? 'LIVE' : prettyResult(r.result)}</span>
        {#if r.live}
          <button type="button" class="watch" onclick={onWatch}>Watch</button>
        {:else}
          {#if r.metaUrl && r.num != null}
            <button
              type="button"
              class="icon"
              aria-label="Replay game {r.num}"
              title="Replay"
              disabled={busy === r.num}
              onclick={() => onReplay(r.num!)}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"
                ><polygon points="7 4 20 12 7 20 7 4"></polygon></svg
              >
            </button>
          {/if}
          {#if r.pgnUrl}
            <a class="icon" href={r.pgnUrl} download aria-label="Download PGN for game {r.num}" title="Download PGN">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
                ><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"
                ></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg
              >
            </a>
          {/if}
        {/if}
      </li>
    {/each}
  </ul>
{/if}

<style>
  .filter {
    position: sticky;
    top: 0;
    z-index: 1;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px 12px;
    padding: 12px 14px;
    background: var(--surface);
    border-bottom: 1px solid var(--line);
  }
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
  }
  .search {
    flex: 1 1 180px;
    position: relative;
  }
  .search svg {
    position: absolute;
    left: 10px;
    top: 50%;
    transform: translateY(-50%);
    color: var(--muted);
  }
  .search input {
    width: 100%;
    height: var(--pCtlH);
    box-sizing: border-box;
    padding: 0 10px 0 34px;
    border: 1px solid var(--line);
    background: var(--surface2);
    color: var(--text);
    font-size: 13px;
  }
  .check {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    min-height: var(--pCtlH);
    font-size: 13px;
    color: var(--text);
    cursor: pointer;
  }
  .check input {
    width: 16px;
    height: 16px;
    margin: 0;
  }
  .muted {
    margin: 0;
    padding: 14px;
    color: var(--muted);
  }
  .err {
    padding-bottom: 0;
  }
  .games {
    list-style: none;
    margin: 0;
    padding: 4px 8px 10px;
  }
  .games li {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 6px;
    border-bottom: 1px solid var(--line2);
  }
  .games li.current {
    background: var(--sel);
  }
  .num {
    width: 32px;
    flex-shrink: 0;
    font-family: var(--fontMono);
    font-size: 12px;
    color: var(--muted);
  }
  .names {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }
  .name {
    display: flex;
    align-items: center;
    gap: 7px;
    font-size: 13px;
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .name.win {
    font-weight: 700;
  }
  .disc {
    width: 9px;
    height: 9px;
    flex-shrink: 0;
    box-sizing: border-box;
    border: 1px solid;
  }
  /* Theme-invariant disc colours, as in PlayerBar. */
  .disc.white {
    background: #eceff4;
    border-color: #b4bccb;
  }
  .disc.black {
    background: #2e3440;
    border-color: #81a1c1;
  }
  .res {
    min-width: 44px;
    text-align: center;
    font-family: var(--fontMono);
    font-size: 12px;
    font-weight: 600;
    color: var(--text);
  }
  .res.live {
    color: var(--liveText);
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
    color: var(--text);
    cursor: pointer;
  }
  .icon:disabled {
    opacity: 0.5;
    cursor: default;
  }
  a.icon {
    color: var(--muted);
  }
  .watch {
    height: var(--pIconBtn);
    box-sizing: border-box;
    padding: 0 10px;
    border: 0;
    background: var(--liveBg);
    /* Theme-invariant: text on the live-coloured Watch button. */
    color: #fff;
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;
  }
</style>
