<script lang="ts">
  import { onMount } from 'svelte';
  import { getGameStore } from '$lib/game.svelte';
  import { crosstable } from '$lib/standings';
  import { getTournament } from '$lib/tournament.svelte';
  import type { ViewerSource } from '$lib/url';

  type Props = { source: ViewerSource };
  const { source }: Props = $props();
  const game = getGameStore();
  const tournament = getTournament();

  onMount(() => void tournament.refresh());
  const rows = $derived(
    tournament.results
      ? crosstable(
          tournament.results,
          game.live ? { white: game.live.game.white.name, black: game.live.game.black.name } : null,
        )
      : [],
  );
</script>

<div class="standings">
  <div class="head">
    <h3>Standings</h3>
    {#if tournament.totalGames != null}
      <span class="count">{tournament.totalGames} games played</span>
    {/if}
  </div>
  {#if tournament.loading && !tournament.results}
    <p class="muted">Loading…</p>
  {:else if tournament.error && !tournament.results}
    <p class="muted">{tournament.error}</p>
  {:else if rows.length === 0}
    <p class="muted">No standings available yet.</p>
  {:else}
    <div class="scroll">
      <table class="crosstable">
        <thead>
          <tr>
            <th scope="col" class="rank-h">#</th>
            <th scope="col">Engine</th>
            <th scope="col" class="g-h">G</th>
            <th scope="col" class="pts-h">Pts</th>
            {#each rows as r (r.rank + r.name)}
              <th scope="col" class="h2h" title={r.name}>{r.rank}</th>
            {/each}
          </tr>
        </thead>
        <tbody>
          {#each rows as r (r.rank + r.name)}
            <tr>
              <td class="rank">{r.rank}</td>
              <th scope="row" class="name-cell">
                <span class="name-inner">
                  {r.name}
                  {#if r.playing}<span class="dot" title="Playing now"></span>{/if}
                </span>
              </th>
              <td class="g">{r.games}</td>
              <td class="pts">{r.points}</td>
              {#each r.cells as c, j (j)}
                <td class="h2h {c.kind}">{c.text}</td>
              {/each}
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
    <p class="foot">
      Head-to-head is the row engine's score against each column. * marks a game in progress.
      {#if source.kind === 'live'}
        <a href="/{source.port}/result-table" target="_blank" rel="noopener noreferrer">Raw results table</a>
      {/if}
    </p>
  {/if}
</div>

<style>
  .standings {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 14px;
  }
  .head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 8px;
  }
  h3 {
    margin: 0;
    font-size: 15px;
    font-weight: 600;
  }
  .count,
  .muted,
  .foot {
    font-size: 12px;
    color: var(--muted);
  }
  .muted,
  .foot {
    margin: 0;
  }
  .foot a {
    color: var(--link);
  }
  .scroll {
    overflow-x: auto;
    border: 1px solid var(--line);
  }
  .crosstable {
    width: 100%;
    min-width: 560px;
    border-collapse: collapse;
    font-size: 13px;
  }
  .crosstable thead tr {
    font-size: 11px;
    color: var(--muted);
    background: var(--surface2);
  }
  .crosstable thead th {
    padding: 8px 6px;
    text-align: left;
    font-weight: 600;
  }
  .crosstable thead th.rank-h {
    padding: 8px 6px 8px 10px;
  }
  .crosstable thead th.g-h {
    text-align: right;
  }
  .crosstable thead th.pts-h {
    padding: 8px 10px 8px 6px;
    text-align: right;
  }
  .crosstable thead th.h2h {
    width: 34px;
    padding: 8px 2px;
    text-align: center;
    font-family: var(--fontMono);
  }
  .crosstable tbody tr {
    border-top: 1px solid var(--line);
  }
  .rank {
    padding: 9px 6px 9px 10px;
    font-family: var(--fontMono);
    color: var(--muted);
  }
  .name-cell {
    padding: 9px 6px;
    text-align: left;
    font-weight: 600;
    white-space: nowrap;
  }
  .name-inner {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  .dot {
    width: 6px;
    height: 6px;
    background: var(--liveText);
  }
  .g {
    padding: 9px 6px;
    text-align: right;
    font-family: var(--fontMono);
    color: var(--muted);
  }
  .pts {
    padding: 9px 10px 9px 6px;
    text-align: right;
    font-family: var(--fontMono);
    font-weight: 600;
  }
  .crosstable td.h2h {
    padding: 9px 2px;
    text-align: center;
    font-family: var(--fontMono);
    font-size: 12px;
  }
  .crosstable td.win {
    background: var(--posBg);
    font-weight: 600;
  }
  .crosstable td.loss,
  .crosstable td.none {
    color: var(--muted);
  }
  .crosstable td.self {
    background: var(--surface2);
  }
</style>
