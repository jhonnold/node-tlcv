<script lang="ts">
  import { onMount } from 'svelte';
  import { innerHeight, innerWidth } from 'svelte/reactivity/window';
  import { getGameStore } from '$lib/game.svelte';
  import { formatDuration } from '$lib/format';
  import { floor8, gameText, getView } from '$lib/view.svelte';
  import type { HeaderInfo, Side } from '$lib/view.svelte';
  import Board from '../Board.svelte';
  import EvalBar from '../EvalBar.svelte';

  type Props = { info: HeaderInfo; onexit: () => void };
  const { info, onexit }: Props = $props();

  const game = getGameStore();
  const view = getView();

  // 44 bar + 16 margin + 2 × (44 row + 8 gap) + 16 bottom = 180; 22 = eval bar 14 + gap 8; 40 = side padding.
  const size = $derived(
    floor8(Math.max(160, Math.min((innerWidth.current ?? 0) - 40 - 22, (innerHeight.current ?? 0) - 180))),
  );
  const caption = $derived([gameText(info), game.game?.opening ?? ''].filter(Boolean).join(' · '));
  let exitBtn: HTMLButtonElement;
  onMount(() => exitBtn.focus());
  function onkeydown(e: KeyboardEvent): void {
    if (e.key !== 'Escape') return;
    e.preventDefault();
    onexit();
  }
</script>

<svelte:window {onkeydown} />

<div class="focus-view">
  <div class="bar">
    <span class="site">{info.site}</span>
    <span>{caption}</span>
    <span class="spacer"></span>
    <button bind:this={exitBtn} type="button" class="exit" onclick={onexit}>Exit focus <kbd>Esc</kbd></button>
  </div>
  <div class="stage" style:width="{size + 22}px">
    {@render row(view.top)}
    <div class="board-row">
      <EvalBar score={game.evalScore} flipped={view.flipped} thickness={14} bordered={false} />
      <Board
        fen={game.fen}
        {size}
        flipped={view.flipped}
        lastMove={game.lastMove}
        arrows={game.arrows}
        label="Main board"
      />
    </div>
    {@render row(view.bottom)}
  </div>
</div>

{#snippet row(side: Side)}
  {@const p = game.players?.[side]}
  {#if p}
    <div class="row {side}" class:active={p.active}>
      <!-- Disc colours are theme-invariant, as in PlayerBar. -->
      <span class="disc"></span>
      <span class="name">{p.name}</span>
      {#if p.score}<span class="score">{p.score}</span>{/if}
      {#if p.thinkMs != null}<span class="think">thinking {formatDuration(p.thinkMs)}</span>{/if}
      <span class="spacer"></span>
      <span class="clock" role="timer" aria-label="{side} clock {p.clock}">{p.clock}</span>
    </div>
  {/if}
{/snippet}

<style>
  .focus-view {
    min-height: 100dvh;
    display: flex;
    flex-direction: column;
    align-items: center;
    background: var(--bg);
  }
  .bar {
    width: 100%;
    height: 44px;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 0 20px;
    font-size: 13px;
    color: var(--muted);
  }
  .bar > span {
    min-width: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .site {
    font-weight: 600;
    color: var(--text);
  }
  .spacer {
    flex: 1;
  }
  .exit {
    height: 32px;
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 0 12px;
    border: 1px solid var(--line);
    background: transparent;
    color: var(--muted);
    font-weight: 600;
  }
  kbd {
    font-family: var(--fontMono);
    font-size: 11px;
    padding: 1px 5px;
    border: 1px solid var(--line);
  }
  .stage {
    margin-top: 16px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .board-row {
    display: flex;
    gap: 8px;
  }
  .row {
    height: 44px;
    display: flex;
    align-items: center;
    gap: 12px;
    padding-left: 22px;
    --c: var(--engW);
  }
  .row.black {
    --c: var(--engB);
  }
  .disc {
    width: 14px;
    height: 14px;
    flex-shrink: 0;
    box-sizing: border-box;
    background: #eceff4;
    border: 1.5px solid #b4bccb;
  }
  .row.black .disc {
    background: #2e3440;
    border-color: #81a1c1;
  }
  .name {
    min-width: 0;
    font-size: 17px;
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .score {
    font-family: var(--fontMono);
    font-size: 15px;
    font-weight: 600;
    color: var(--c);
  }
  .think {
    font-size: 12px;
    color: var(--muted);
    white-space: nowrap;
  }
  .clock {
    height: 38px;
    padding: 0 12px;
    display: inline-flex;
    align-items: center;
    font-family: var(--fontMono);
    font-size: 24px;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    color: var(--muted);
  }
  .row.active .clock {
    background: var(--invBg);
    color: var(--invText);
  }
</style>
