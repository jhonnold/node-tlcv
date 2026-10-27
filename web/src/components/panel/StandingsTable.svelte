<script lang="ts">
  import type { XPairKind, XRow } from '$lib/standings';

  type Props = { rows: XRow[]; wide: boolean };
  const { rows, wide }: Props = $props();

  const gauntlet = $derived(rows.some((r) => r.isHost));
  const hostName = $derived(rows.find((r) => r.isHost)?.name ?? '');
  const LEGEND: { kind: XPairKind; label: string }[] = [
    { kind: 'w2', label: '2–0' },
    { kind: 'w1', label: '1½–½' },
    { kind: 'even', label: '1–1' },
    { kind: 'l1', label: '½–1½' },
    { kind: 'l2', label: '0–2' },
    { kind: 'live', label: 'in progress' },
  ];
</script>

<div class="wrap">
  <table>
    <thead>
      <tr>
        <th scope="col" class="rank-h">#</th>
        <th scope="col">Engine</th>
        <th scope="col" class="num" title="Games played">G</th>
        {#if wide}
          <th scope="col" class="num" title="Wins">W</th>
          <th scope="col" class="num" title="Draws">D</th>
          <th scope="col" class="num" title="Losses">L</th>
        {/if}
        <th scope="col" class="num" title="Points">Pts</th>
        <th scope="col" class="num score" title="Score percentage">Score</th>
        {#if wide && gauntlet}
          <th scope="col" class="extra-h">Pairs, oldest first</th>
        {:else if wide}
          {#each rows as r (r.rank + r.name)}
            <th scope="col" class="h2h" title={r.name}>{r.rank}</th>
          {/each}
        {/if}
      </tr>
    </thead>
    <tbody>
      {#each rows as r (r.rank + r.name)}
        <tr class:host={r.isHost}>
          <td class="rank">{r.rank}</td>
          <th scope="row" class="name" title={r.name}>
            {#if r.playing}<span class="dot" title="Playing now"></span>{/if}
            <span class="label">{r.name}</span>{#if r.isHost}<span class="tag">Gauntlet</span>{/if}
          </th>
          <td class="num muted">{r.games}</td>
          {#if wide}
            <td class="num">{r.w}</td>
            <td class="num muted">{r.d}</td>
            <td class="num">{r.l}</td>
          {/if}
          <td class="num pts">{r.points}</td>
          <td class="num muted">{r.pct}</td>
          {#if wide && gauntlet}
            <td class="extra">
              {#if !r.isHost}
                <span class="pairs" role="img" aria-label="Game pairs against {hostName}, oldest first">
                  {#each r.pairs as p, n (n)}
                    <span class="pair {p.kind}" title={p.label}></span>
                  {/each}
                </span>
              {/if}
            </td>
          {:else if wide}
            {#each r.cells as c, j (j)}
              <td class="h2h {c.kind}">{c.text}</td>
            {/each}
          {/if}
        </tr>
      {/each}
    </tbody>
  </table>
  {#if wide && gauntlet}
    <ul class="legend" aria-label="Pair key">
      {#each LEGEND as k (k.kind)}
        <li><span class="pair {k.kind}"></span>{k.label}</li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .wrap {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
    font-size: 13px;
    border: 1px solid var(--line);
  }
  thead th {
    position: sticky;
    top: 0;
    z-index: 1;
    padding: 8px 6px;
    background: var(--surface2);
    color: var(--muted);
    font-size: 11px;
    font-weight: 600;
    text-align: left;
  }
  tbody tr {
    height: var(--pRowH, 36px);
    border-top: 1px solid var(--line);
  }
  tbody tr.host {
    background: var(--hostBg);
  }
  .rank-h,
  .rank {
    width: 30px;
    padding: 0 4px 0 10px;
  }
  .rank {
    font-family: var(--fontMono);
    color: var(--muted);
  }
  .num {
    width: 40px;
    padding: 0 6px;
    text-align: right;
    font-family: var(--fontMono);
  }
  thead th.num {
    font-family: inherit;
  }
  .score {
    width: 64px;
  }
  .pts {
    width: 46px;
    font-weight: 600;
  }
  .muted {
    color: var(--muted);
  }
  .name {
    overflow: hidden;
    padding: 0 6px;
    text-align: left;
    font-weight: 600;
    white-space: nowrap;
  }
  .label {
    display: inline-block;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    vertical-align: middle;
  }
  .dot {
    display: inline-block;
    width: 6px;
    height: 6px;
    margin-right: 6px;
    vertical-align: middle;
    background: var(--liveText);
  }
  .tag {
    margin-left: 6px;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--muted);
  }
  .h2h {
    width: 34px;
    padding: 0 2px;
    text-align: center;
    font-family: var(--fontMono);
    font-size: 12px;
  }
  thead th.h2h {
    font-family: var(--fontMono);
  }
  td.h2h.win {
    background: var(--posBg);
    font-weight: 600;
  }
  td.h2h.loss,
  td.h2h.none {
    color: var(--muted);
  }
  td.h2h.self {
    background: var(--surface2);
  }
  .extra-h {
    padding-left: 12px;
  }
  .extra {
    padding: 0 10px;
  }
  .pairs {
    display: flex;
    gap: 4px;
  }
  .pair {
    flex-shrink: 0;
    width: 16px;
    height: 16px;
    box-sizing: border-box;
    border: 1px solid transparent;
  }
  .pair.w2 {
    background: var(--win2);
    border-color: var(--win2);
  }
  .pair.w1 {
    background: var(--win);
    border-color: var(--win);
  }
  .pair.even {
    border-color: var(--even);
  }
  .pair.l1 {
    background: var(--loss);
    border-color: var(--loss);
  }
  .pair.l2 {
    background: var(--loss2);
    border-color: var(--loss2);
  }
  .pair.live {
    border: 1px dashed var(--liveText);
  }
  .legend {
    display: flex;
    flex-wrap: wrap;
    gap: 6px 16px;
    margin: 0;
    padding: 0;
    list-style: none;
    font-family: var(--fontMono);
    font-size: 12px;
    color: var(--muted);
  }
  .legend li {
    display: flex;
    align-items: center;
    gap: 6px;
  }
</style>
