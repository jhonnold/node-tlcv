<script module lang="ts">
  export const PV_LINE = 20; // px per PV line
  export const PV_LINES = 3; // default PV lines
  export const SHORT_PV_LINE = 18; // px per PV line in the short card (12px × 1.5)
</script>

<script lang="ts">
  import Board from './Board.svelte';
  import type { EngineView } from '$lib/engines';
  import { copyFen, EMPTY_FEN } from '$lib/fen';
  import { DASH } from '$lib/format';
  import { onDestroy } from 'svelte';

  type Props = {
    engine: EngineView;
    compact?: boolean;
    thumb?: number;
    flipped?: boolean;
    lines?: number;
    short?: boolean;
  };
  const { engine, compact = false, thumb = 0, flipped = false, lines, short = false }: Props = $props();

  const ROLE = { white: 'White', black: 'Black', kibitzer: 'Kibitzer' } as const;
  const label = $derived(`${ROLE[engine.role]} engine ${engine.name}, score ${engine.score}`);
  // PV lines: `lines`, else PV_LINES, or as many as fit beside the PV-end board. The PV box keeps this
  // height, so the card never grows or shrinks with the PV.
  const pvLines = $derived(lines ?? Math.max(PV_LINES, Math.floor(thumb / PV_LINE)));
  const pvText = $derived([engine.pv.pre, engine.pv.first, engine.pv.rest].filter(Boolean).join(' '));
  const stats = $derived([
    { k: 'Depth', v: engine.depth },
    { k: 'Nodes', v: engine.nodes },
    { k: 'NPS', v: engine.nps },
    { k: 'Time', v: engine.time },
  ]);
  const inline = $derived(
    [
      engine.depth === DASH ? DASH : `d${engine.depth}`,
      engine.nodes,
      engine.nps === DASH ? DASH : `${engine.nps}/s`,
      engine.time,
    ].join(' · '),
  );
  // Short card, row 2: the inline stats, then the status when there is one.
  const shortStats = $derived([inline, engine.status].filter(Boolean).join(' · '));

  let copied = $state(false);
  let copiedTimer: ReturnType<typeof setTimeout> | undefined;
  onDestroy(() => clearTimeout(copiedTimer));
  async function copy(): Promise<void> {
    if (!engine.pvFen || !(await copyFen(engine.pvFen))) return;
    copied = true;
    clearTimeout(copiedTimer);
    copiedTimer = setTimeout(() => (copied = false), 1200);
  }
</script>

{#snippet pvSpans()}
  {#if engine.pv.pre}<span class="pre">{engine.pv.pre}</span>{/if}
  <strong>{engine.pv.first}</strong>
  <span class="rest">{engine.pv.rest}</span>
{/snippet}

<!-- The PV-end board; clicking it copies the FEN. The short card shows "Copied" over the board, with no caption. -->
{#snippet thumbButton(overlay: boolean)}
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
    {#if !overlay}<span>{copied ? 'Copied' : 'PV end'}</span>
    {:else if copied}<span class="copied">Copied</span>{/if}
  </button>
{/snippet}

{#if short}
  <article class="card short {engine.role}" aria-label={label}>
    <div class="main">
      <div class="head">
        <span class="swatch" aria-hidden="true"></span>
        <span class="name">{engine.name}</span>
        <span class="role">{ROLE[engine.role]}</span>
        <span class="spacer"></span>
        <span class="score">{engine.score}</span>
      </div>
      <span class="sstats">{shortStats}</span>
      <p class="pv" style:--pv-line="{SHORT_PV_LINE}px" style:--pv-lines={2} title={pvText}>{@render pvSpans()}</p>
    </div>
    {#if thumb > 0}{@render thumbButton(true)}{/if}
  </article>
{:else}
  <article class="card {engine.role}" class:compact class:noboard={!thumb} aria-label={label}>
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
      <p class="pv" style:--pv-line="{PV_LINE}px" style:--pv-lines={pvLines} title={pvText}>
        {@render pvSpans()}
      </p>
      {#if thumb > 0}{@render thumbButton(false)}{/if}
    </div>
  </article>
{/if}

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
    container-type: inline-size;
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
  /* Narrow compact cards (tablet) always put the stats under the score, so "—" → data never re-wraps. */
  @container (width < 320px) {
    .inline {
      flex-basis: 100%;
    }
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
    color: var(--muted);
    line-height: var(--pv-line);
    height: calc(var(--pv-lines) * var(--pv-line));
    overflow: hidden;
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: var(--pv-lines);
    line-clamp: var(--pv-lines);
  }
  /* Narrow cards with no PV board (tablet side cards, < 320 px content) reserve 2 PV lines, so the column
     stays no taller than its board. Cards beside a PV board keep their lines. */
  @container (width < 320px) {
    .noboard .pv {
      height: calc(2 * var(--pv-line));
      -webkit-line-clamp: 2;
      line-clamp: 2;
    }
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
  /* Short card (Engine.dc.html `short`): one row, PV board at the right. Height = max(82, thumb) + 22. */
  .card.short {
    flex-direction: row;
    align-items: flex-start;
    gap: 12px;
    padding: 10px 12px;
  }
  .main {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .short .name {
    font-size: 13px;
  }
  .short .score {
    font-size: 17px;
    letter-spacing: -0.02em;
    line-height: 22px;
  }
  .sstats {
    font-family: var(--fontMono);
    font-size: 11.5px;
    line-height: 16px;
    color: var(--muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .short .pv {
    flex: none;
    font-size: 12px;
  }
  .short .thumb {
    position: relative;
    flex-shrink: 0;
  }
  .copied {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    padding: 2px 0;
    background: var(--surface);
    color: var(--text);
    text-align: center;
  }
</style>
