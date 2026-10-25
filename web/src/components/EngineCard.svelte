<script lang="ts">
  import Board from './Board.svelte';
  import type { EngineView } from '$lib/engines';
  import { copyFen, EMPTY_FEN } from '$lib/fen';
  import { DASH } from '$lib/format';
  import { onDestroy } from 'svelte';

  type Props = {
    engine: EngineView;
    thumb?: number;
    flipped?: boolean;
  };
  const { engine, thumb = 0, flipped = false }: Props = $props();
  const PV_LINE = 18; // px per PV line (12px × 1.5); 2 lines, so the card height never changes

  const ROLE = { white: 'White', black: 'Black', kibitzer: 'Kibitzer' } as const;
  const label = $derived(`${ROLE[engine.role]} engine ${engine.name}, score ${engine.score}`);
  const pvText = $derived([engine.pv.pre, engine.pv.first, engine.pv.rest].filter(Boolean).join(' '));
  const inline = $derived(
    [
      engine.depth === DASH ? DASH : `d${engine.depth}`,
      engine.nodes,
      engine.nps === DASH ? DASH : `${engine.nps}/s`,
      engine.time,
    ].join(' · '),
  );
  // Row 2: the inline stats, then the status when there is one.
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
{#snippet thumbButton()}
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
    {#if copied}<span class="copied" aria-hidden="true">Copied</span>{/if}
  </button>
{/snippet}

<!-- Announces the copy outside the button, where a live region is read; the visual strip is aria-hidden. -->
{#snippet copyStatus()}
  <span class="sr-only" role="status">{copied ? 'FEN copied' : ''}</span>
{/snippet}

<article class="card {engine.role}" aria-label={label}>
  <div class="main">
    <div class="head">
      <span class="swatch" aria-hidden="true"></span>
      <span class="name">{engine.name}</span>
      <span class="role">{ROLE[engine.role]}</span>
      <span class="spacer"></span>
      <span class="score">{engine.score}</span>
    </div>
    <span class="sstats">{shortStats}</span>
    <p class="pv" style:--pv-line="{PV_LINE}px" style:--pv-lines={2} title={pvText}>{@render pvSpans()}</p>
  </div>
  {#if thumb > 0}{@render thumbButton()}{/if}
  {@render copyStatus()}
</article>

<style>
  /* Engine.dc.html `short`: one row, PV board at the right. Height = max(82, thumb) + 22. */
  .card {
    --c: var(--engW);
    width: 100%;
    box-sizing: border-box;
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 10px 12px;
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
    font-size: 13px;
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
  .score {
    font-family: var(--fontMono);
    font-size: 17px;
    font-weight: 600;
    letter-spacing: -0.02em;
    line-height: 22px;
  }
  .main {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
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
  .pv {
    flex: none;
    min-width: 0;
    margin: 0;
    font-family: var(--fontMono);
    font-size: 12px;
    color: var(--muted);
    line-height: var(--pv-line);
    height: calc(var(--pv-lines) * var(--pv-line));
    overflow: hidden;
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: var(--pv-lines);
    line-clamp: var(--pv-lines);
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
    position: relative;
    flex-shrink: 0;
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
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
  }
</style>
