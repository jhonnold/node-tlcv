<script lang="ts">
  import { onMount } from 'svelte';
  import { getGameStore } from '$lib/game.svelte';
  import { crosstable } from '$lib/standings';
  import { getTournament } from '$lib/tournament.svelte';
  import type { ViewerSource } from '$lib/url';
  import Icon from '../viewer/Icon.svelte';
  import StandingsDialog from './StandingsDialog.svelte';
  import StandingsTable from './StandingsTable.svelte';

  type Props = { source: ViewerSource };
  const { source }: Props = $props();
  const game = getGameStore();
  const tournament = getTournament();

  onMount(() => void tournament.refresh());
  // Strings, so the crosstable isn't rebuilt on every delta (game.live changes each time).
  const liveWhite = $derived(game.live?.game.white.name ?? null);
  const liveBlack = $derived(game.live?.game.black.name ?? null);
  const rows = $derived(
    tournament.results
      ? crosstable(
          tournament.results,
          liveWhite != null && liveBlack != null ? { white: liveWhite, black: liveBlack } : null,
        )
      : [],
  );
  const gauntlet = $derived(rows.some((r) => r.isHost));
  const hostName = $derived(rows.find((r) => r.isHost)?.name ?? '');

  // Round robins have a second view, the crosstable. A gauntlet has only the table; its pairs show in the dialog.
  let view = $state<'table' | 'cross'>('table');
  const showCross = $derived(view === 'cross' && !gauntlet);
  let expanded = $state(false);
</script>

<div class="standings">
  <div class="head">
    <h3>Standings</h3>
    {#if tournament.totalGames != null}
      <span class="count">{tournament.totalGames} games played{gauntlet ? ' · gauntlet' : ''}</span>
    {/if}
    <span class="spacer"></span>
    {#if rows.length > 0 && !gauntlet}
      <div class="seg" role="group" aria-label="Standings view">
        <button type="button" aria-pressed={view === 'table'} onclick={() => (view = 'table')}>Table</button>
        <button type="button" aria-pressed={view === 'cross'} onclick={() => (view = 'cross')}>Crosstable</button>
      </div>
    {/if}
    {#if rows.length > 0}
      <button
        type="button"
        class="expand"
        aria-label="Open standings full size"
        title="Open full size"
        onclick={() => (expanded = true)}
      >
        <Icon name="focus" size={14} />
      </button>
    {/if}
  </div>
  {#if tournament.loading && !tournament.results}
    <p class="muted">Loading…</p>
  {:else if tournament.error && !tournament.results}
    <p class="muted">{tournament.error}</p>
  {:else if rows.length === 0}
    <p class="muted">No standings available yet.</p>
  {:else}
    {#if showCross}
      <div class="scroll">
        <table class="cross">
          <thead>
            <tr>
              <th scope="col" class="first">Engine</th>
              {#each rows as r (`${r.rank}:${r.name}`)}
                <th scope="col" class="h2h" title={r.name}>{r.rank}</th>
              {/each}
            </tr>
          </thead>
          <tbody>
            {#each rows as r (`${r.rank}:${r.name}`)}
              <tr>
                <th scope="row" class="first" title={r.name}>
                  <span class="rank">{r.rank}</span>
                  {r.name}
                </th>
                {#each r.cells as c, j (j)}
                  <td class="h2h {c.kind}">{c.text}</td>
                {/each}
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {:else}
      <StandingsTable {rows} wide={false} />
    {/if}
    <p class="foot">
      {#if gauntlet}
        Open full size to see each engine's game pairs against {hostName}. A pair is one opening played with both
        colours.
      {:else}
        Head-to-head is the row engine's score against each column. * marks a game in progress.
      {/if}
      {#if source.kind === 'live'}
        <a href="/{source.port}/result-table" target="_blank" rel="noopener noreferrer">Raw results table</a>
      {/if}
    </p>
  {/if}
</div>

<StandingsDialog {rows} totalGames={tournament.totalGames} open={expanded} onclose={() => (expanded = false)} />

<style>
  .standings {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 14px;
  }
  .head {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    min-height: var(--pIconBtn);
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
  .spacer {
    flex: 1;
  }
  .foot a {
    color: var(--link);
  }
  .seg {
    display: flex;
    gap: 2px;
    padding: 2px;
    background: var(--surface2);
  }
  .seg button {
    height: var(--pSegH);
    padding: 0 10px;
    border: 0;
    background: transparent;
    color: var(--muted);
    font-size: 12px;
    font-weight: 600;
    white-space: nowrap;
    cursor: pointer;
  }
  .seg button[aria-pressed='true'] {
    background: var(--surface);
    color: var(--text);
  }
  .expand {
    width: var(--pIconBtn);
    height: var(--pIconBtn);
    flex-shrink: 0;
    display: grid;
    place-items: center;
    border: 1px solid var(--line);
    background: transparent;
    color: var(--muted);
    cursor: pointer;
  }
  .scroll {
    overflow-x: auto;
    border: 1px solid var(--line);
  }
  .cross {
    border-collapse: separate;
    border-spacing: 0;
    font-size: 12px;
  }
  .cross th,
  .cross td {
    height: var(--pRowH, 36px);
    padding: 0;
  }
  .cross thead th {
    position: sticky;
    top: 0;
    z-index: 1;
    background: var(--surface2);
    color: var(--muted);
    font-family: var(--fontMono);
    font-weight: 600;
  }
  .cross th.first {
    position: sticky;
    left: 0;
    z-index: 2;
    width: 150px;
    min-width: 150px;
    max-width: 150px;
    overflow: hidden;
    padding: 0 6px 0 10px;
    text-align: left;
    font-family: inherit;
    font-weight: 600;
    white-space: nowrap;
    text-overflow: ellipsis;
    background: var(--surface);
    border-right: 1px solid var(--line);
  }
  .cross thead th.first {
    background: var(--surface2);
    color: var(--muted);
  }
  .cross tbody th.first {
    border-top: 1px solid var(--line);
  }
  .rank {
    margin-right: 6px;
    font-family: var(--fontMono);
    font-weight: 400;
    color: var(--muted);
  }
  .cross .h2h {
    min-width: 36px;
    width: 36px;
    text-align: center;
    font-family: var(--fontMono);
    border-top: 1px solid var(--line);
  }
  .cross thead .h2h {
    border-top: 0;
  }
  .cross td.win {
    background: var(--posBg);
    font-weight: 600;
  }
  .cross td.loss,
  .cross td.none {
    color: var(--muted);
  }
  .cross td.self {
    background: var(--surface2);
  }
</style>
