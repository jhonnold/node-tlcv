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

  const ROLE = { white: 'White', black: 'Black', kibitzer: 'Kibitzer' } as const;
  const pct = (permille: number) => `${(permille / 10).toFixed(1)}%`;
  // WDL is per mille in White's view: [win, draw, loss].
  const wdlText = $derived(engine.wdl ? `[${engine.wdl[0]}w, ${engine.wdl[1]}d, ${engine.wdl[2]}l]` : '');
  const wdlAria = $derived(
    engine.wdl ? `, win ${pct(engine.wdl[0])}, draw ${pct(engine.wdl[1])}, loss ${pct(engine.wdl[2])} for White` : '',
  );
  const label = $derived(`${ROLE[engine.role]} engine ${engine.name}, score ${engine.score}${wdlAria}`);
  const pvText = $derived([engine.pv.pre, engine.pv.first, engine.pv.rest].filter(Boolean).join(' '));
  // Stats row: depth/seldepth · nodes · nps · hashfull · tbhits. Absent parts are dropped.
  const stats = $derived(
    [
      engine.depth === DASH ? null : `d${engine.depth}${engine.seldepth ? `/${engine.seldepth}` : ''}`,
      engine.nodes === DASH ? null : engine.nodes,
      engine.nps === DASH ? null : `${engine.nps}/s`,
      engine.hashfull,
      engine.tbhits,
    ]
      .filter(Boolean)
      .join(' · ') || DASH,
  );

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

<article class="card {engine.role}" aria-label={label}>
  <div class="main">
    <div class="head">
      <span class="swatch" aria-hidden="true"></span>
      <span class="score">{engine.score}</span>
      {#if wdlText}<span class="wdl" title="Win / draw / loss per mille, White’s view">{wdlText}</span>{/if}
      <!-- White/Black names are in the player bars; only the kibitzer card names its engine. -->
      {#if engine.role === 'kibitzer'}
        <span class="name">{engine.name}</span>
        <!-- Without a live kibitzer name (archives) the name is the 'Kibitzer' fallback (lib/engines.ts): don't repeat it. -->
        {#if engine.name !== ROLE.kibitzer}<span class="role">{ROLE.kibitzer}</span>{/if}
      {/if}
    </div>
    <span class="sstats">{stats}</span>
    <p class="pv" title={pvText}>
      {#if engine.pv.pre}<span class="pre">{engine.pv.pre}</span>{/if}
      <strong>{engine.pv.first}</strong>
      <span class="rest">{engine.pv.rest}</span>
    </p>
  </div>
  {#if thumb > 0}
    <!-- The PV-end board; clicking it copies the FEN and shows "Copied" over the board. -->
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
  {/if}
  <!-- Announces the copy outside the button, where a live region is read; the visual strip is aria-hidden. -->
  <span class="sr-only" role="status">{copied ? 'FEN copied' : ''}</span>
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
    align-items: baseline;
    gap: 8px;
    min-width: 0;
    overflow: hidden;
  }
  .swatch {
    align-self: center;
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
  .score {
    flex-shrink: 0;
    font-family: var(--fontMono);
    font-size: 17px;
    font-weight: 600;
    letter-spacing: -0.02em;
    line-height: 22px;
  }
  .wdl {
    min-width: 0;
    margin-left: -2px;
    font-family: var(--fontMono);
    font-size: 12px;
    color: var(--muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
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
    line-height: 18px; /* 12px × 1.5 */
    height: 36px; /* always 2 lines, so the card height never changes */
    overflow: hidden;
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    line-clamp: 2;
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
