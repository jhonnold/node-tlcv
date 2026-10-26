<script lang="ts">
  import { onDestroy } from 'svelte';
  import { Chart } from 'chart.js';
  import { getGameStore } from '$lib/game.svelte';
  import { theme } from '$lib/theme/theme.svelte';
  import { averages, buildSeries, chartConfig, GRAPH_IDS, GRAPH_TYPES, markersPlugin, plyX } from '$lib/graphs';
  import type { GraphId, Markers, Pt } from '$lib/graphs';

  const game = getGameStore();
  let graph = $state<GraphId>('eval');
  let canvas = $state<HTMLCanvasElement>();
  let chart: Chart<'line', Pt[]> | null = null; // plain: never put a Chart in $state
  const markers: Markers = { zero: null, x: null, zeroColor: '', markColor: '' };
  const font = getComputedStyle(document.documentElement).getPropertyValue('--fontMono').trim() || 'monospace';

  const series = $derived(buildSeries(game.moves, graph));
  const noun = $derived(GRAPH_TYPES[graph].aria ?? GRAPH_TYPES[graph].label.toLowerCase());
  // Strings, not one object: the game object changes on every delta and would re-run the chart effect.
  const whiteName = $derived(game.game?.white.name ?? 'White');
  const blackName = $derived(game.game?.black.name ?? 'Black');
  const kibitzerName = $derived(game.game?.kibitzerLiveData?.name ?? 'Kibitzer');
  const whiteAvg = $derived(averages(game.moves, 'w'));
  const blackAvg = $derived(averages(game.moves, 'b'));

  $effect(() => {
    if (!canvas) return;
    const c = theme.colors; // reading it here is what re-colours on a theme change
    const cur = !game.following && game.index > 0 ? game.moves[game.index - 1] : null;
    Object.assign(markers, {
      zero: GRAPH_TYPES[graph].zero ?? null,
      x: cur ? plyX(cur) : null,
      zeroColor: c.muted,
      markColor: c.text,
    });
    const cfg = chartConfig(
      graph,
      game.moves,
      series,
      { white: whiteName, black: blackName, kibitzer: kibitzerName },
      { w: c.engW, b: c.engB, k: c.engK, text: c.text, muted: c.muted, line: c.line, surface2: c.surface2, font },
      (ply) => game.goTo(ply), // bound: goTo is a method, not an arrow field
    );
    if (!chart) chart = new Chart(canvas, { ...cfg, plugins: [markersPlugin(markers)] });
    else {
      chart.data = cfg.data;
      chart.options = cfg.options ?? {};
      chart.update('none');
    }
  });
  onDestroy(() => {
    chart?.destroy();
    chart = null;
  });
</script>

<div class="graphs">
  <div class="seg" role="group" aria-label="Graph type">
    {#each GRAPH_IDS as id (id)}
      <button type="button" aria-pressed={graph === id} class:sel={graph === id} onclick={() => (graph = id)}>
        {GRAPH_TYPES[id].label}
      </button>
    {/each}
  </div>
  <figure>
    <figcaption>
      <span>{GRAPH_TYPES[graph].title}</span>
      <span>by move</span>
    </figcaption>
    <div class="chart">
      <canvas bind:this={canvas} aria-label="Line chart of {noun} per move for both engines"></canvas>
    </div>
  </figure>
  <ul class="legend">
    <li><span class="swatch" style:background="var(--engW)"></span>{whiteName}</li>
    <li><span class="swatch" style:background="var(--engB)"></span>{blackName}</li>
    {#if graph === 'eval' && series.pts[2].length}
      <li><span class="swatch dashed"></span>{kibitzerName} (kibitzer)</li>
    {/if}
    {#if GRAPH_TYPES[graph].sub && (series.pts[3].length || series.pts[4].length)}
      <li><span class="swatch dotted"></span>{GRAPH_TYPES[graph].sub?.label}</li>
    {/if}
  </ul>
  <table class="averages">
    <thead>
      <tr>
        <th scope="col" class="start">Engine</th>
        <th scope="col">Avg depth</th>
        <th scope="col">Avg NPS</th>
        <th scope="col">Clock used</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <th scope="row">{whiteName}</th>
        <td>{whiteAvg.depth}</td>
        <td>{whiteAvg.nps}</td>
        <td>{whiteAvg.clock}</td>
      </tr>
      <tr>
        <th scope="row">{blackName}</th>
        <td>{blackAvg.depth}</td>
        <td>{blackAvg.nps}</td>
        <td>{blackAvg.clock}</td>
      </tr>
    </tbody>
  </table>
</div>

<style>
  .graphs {
    display: flex;
    flex-direction: column;
    gap: 14px;
    padding: 14px;
  }
  .seg {
    display: flex;
    gap: 4px;
    padding: 3px;
    background: var(--surface2);
  }
  .seg button {
    flex: 1 1 auto;
    padding: 0 2px;
    white-space: nowrap;
    height: var(--pSegH);
    border: 0;
    background: transparent;
    color: var(--muted);
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
  }
  .seg button.sel {
    background: var(--surface);
    color: var(--text);
  }
  figure {
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  figcaption {
    display: flex;
    justify-content: space-between;
    font-size: 12px;
    color: var(--muted);
  }
  .chart {
    position: relative;
    height: var(--pChartH);
  }
  .legend {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-wrap: wrap;
    gap: 6px 16px;
    font-size: 12px;
    color: var(--muted);
  }
  .legend li {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .swatch {
    width: 14px;
    height: 3px;
  }
  .swatch.dashed {
    height: 0;
    border-top: 2px dashed var(--engK);
  }
  .swatch.dotted {
    height: 0;
    border-top: 2px dotted var(--muted);
  }
  .averages {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
  }
  .averages thead th {
    padding: 6px 0;
    border-bottom: 1px solid var(--line);
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--muted);
    text-align: right;
  }
  .averages thead th.start {
    text-align: left;
  }
  .averages tbody {
    font-family: var(--fontMono);
  }
  .averages tbody th {
    padding: 8px 0;
    font-family: var(--fontUi);
    font-weight: 600;
    text-align: left;
  }
  .averages tbody td {
    padding: 8px 0;
    text-align: right;
  }
</style>
