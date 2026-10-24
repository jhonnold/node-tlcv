<script lang="ts">
  import Board from './Board.svelte';
  import type { EngineView } from '$lib/engines';
  import { copyFen, EMPTY_FEN } from '$lib/fen';
  import { DASH } from '$lib/format';

  type Props = {
    engine: EngineView;
    compact?: boolean;
    thumb?: number;
    flipped?: boolean;
  };
  const { engine, compact = false, thumb = 0, flipped = false }: Props = $props();

  const ROLE = { white: 'White', black: 'Black', kibitzer: 'Kibitzer' } as const;
  const stats = $derived([
    { k: 'Depth', v: engine.depth },
    { k: 'Nodes', v: engine.nodes },
    { k: 'NPS', v: engine.nps },
    { k: 'Time', v: engine.time },
  ]);
  const inline = $derived(
    [`d${engine.depth}`, engine.nodes, engine.nps === DASH ? DASH : `${engine.nps}/s`, engine.time].join(' · '),
  );

  let copied = $state(false);
  async function copy(): Promise<void> {
    if (!engine.pvFen || !(await copyFen(engine.pvFen))) return;
    copied = true;
    setTimeout(() => (copied = false), 1200);
  }
</script>

<article
  class="card {engine.role}"
  class:compact
  aria-label="{ROLE[engine.role]} engine {engine.name}, score {engine.score}"
>
  <div class="head">
    <span class="swatch" aria-hidden="true"></span>
    <span class="name">{engine.name}</span>
    <span class="role">{ROLE[engine.role]}</span>
    <span class="spacer"></span>
    <span class="status">{engine.status}</span>
  </div>
  <div class="numbers">
    <span class="score">{engine.score}</span>
    {#if compact}
      <span class="inline">{inline}</span>
    {:else}
      <dl>
        {#each stats as s (s.k)}
          <div>
            <dt>{s.k}</dt>
            <dd>{s.v}</dd>
          </div>
        {/each}
      </dl>
    {/if}
  </div>
  <div class="pvrow">
    <p class="pv">
      {#if engine.pv.pre}<span class="pre">{engine.pv.pre}</span>{/if}
      <strong>{engine.pv.first}</strong>
      <span class="rest">{engine.pv.rest}</span>
    </p>
    {#if thumb > 0}
      <button
        type="button"
        class="thumb"
        aria-label="Copy FEN of PV end position"
        title="PV end position — click to copy FEN"
        disabled={!engine.pvFen}
        onclick={copy}
      >
        <Board
          fen={engine.pvFen ?? EMPTY_FEN}
          size={thumb}
          coords={false}
          animate={false}
          {flipped}
          label="PV end position"
        />
        <span>{copied ? 'Copied' : 'PV end'}</span>
      </button>
    {/if}
  </div>
</article>

<style>
  .card {
    --c: var(--engW);
    width: 100%;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 14px;
    border: 1px solid var(--line);
    background: var(--surface);
    color: var(--text);
    font-family: var(--fontUi);
  }
  .card.black {
    --c: var(--engB);
  }
  .card.kibitzer {
    --c: var(--engK);
  }
  .card.compact {
    gap: 8px;
    padding: 12px;
  }
  .head {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }
  .swatch {
    width: 10px;
    height: 10px;
    flex-shrink: 0;
    background: var(--c);
  }
  .name {
    min-width: 0;
    font-size: 14px;
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .role {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--muted);
  }
  .spacer {
    flex: 1;
  }
  .status {
    font-size: 12px;
    color: var(--muted);
    white-space: nowrap;
  }
  .numbers {
    display: flex;
    align-items: baseline;
    flex-wrap: wrap;
    gap: 14px;
  }
  .score {
    font-family: var(--fontMono);
    font-size: 28px;
    font-weight: 600;
    letter-spacing: -0.03em;
    line-height: 1;
  }
  .compact .score {
    font-size: 22px;
  }
  .inline {
    font-family: var(--fontMono);
    font-size: 12px;
    color: var(--muted);
  }
  dl {
    flex: 1;
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 8px;
    margin: 0;
  }
  dl div {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }
  dt {
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--muted);
  }
  dd {
    margin: 0;
    font-family: var(--fontMono);
    font-size: 13px;
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .pvrow {
    display: flex;
    align-items: flex-start;
    gap: 12px;
  }
  .pv {
    flex: 1;
    min-width: 0;
    margin: 0;
    font-family: var(--fontMono);
    font-size: 12.5px;
    line-height: 1.6;
    color: var(--muted);
  }
  .pre {
    color: var(--faint);
  }
  strong {
    font-weight: 600;
    color: var(--c);
  }
  .rest {
    color: var(--text);
  }
  .thumb {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: 0;
    border: 0;
    background: transparent;
    color: var(--muted);
    font-size: 10px;
    letter-spacing: 0.04em;
  }
  .thumb:disabled {
    cursor: default;
  }
</style>
