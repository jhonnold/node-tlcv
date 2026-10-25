<script lang="ts">
  import Board from '../Board.svelte';
  import EvalBar from '../EvalBar.svelte';
  import { formatScore } from '$lib/format';
  import type { LobbyBroadcast } from '$shared/types';
  import { cardLabel, clock, moveNumber, title } from './lobby';

  type Props = { b: LobbyBroadcast; mobile: boolean };
  const { b, mobile }: Props = $props();
  const move = $derived(moveNumber(b));
</script>

{#snippet row(side: 'white' | 'black')}
  <div class="player">
    {#if !mobile}
      <span class="disc" class:white={side === 'white'} class:black={side === 'black'} aria-hidden="true"></span>
    {/if}
    <span class="name">{side === 'white' ? b.white : b.black}</span>
    <span class="clock mono">{clock(side === 'white' ? b.whiteTime : b.blackTime)}</span>
  </div>
{/snippet}

<a class="live-card" class:mobile href="/{b.port}" data-port={b.port} aria-label={cardLabel(b)}>
  <Board fen={b.fen} size={mobile ? 104 : 150} coords={false} label="{b.white} vs {b.black}" />
  <div class="info">
    <div class="site">{title(b)}</div>
    {#if mobile}
      {@render row('white')}
      {@render row('black')}
      <div class="foot">
        <span class="score mono">{formatScore(b.score)}</span>
        <span class="nowrap">Move {move} · {b.viewerCount} watching</span>
      </div>
    {:else}
      {@render row('black')}
      <div class="eval">
        <div class="track"><EvalBar score={b.score} orientation="horizontal" thickness={6} /></div>
        <span class="score mono">{formatScore(b.score)}</span>
      </div>
      {@render row('white')}
      <div class="spacer"></div>
      <div class="foot">
        <span class="ellipsis">{b.opening}</span>
        <span class="nowrap">Move {move} · {b.viewerCount} watching</span>
      </div>
    {/if}
  </div>
</a>

<style>
  .live-card {
    height: 100%;
    display: flex;
    gap: 16px;
    padding: 16px;
    border: 1px solid var(--line);
    background: var(--surface);
    color: var(--text);
    text-decoration: none;
  }
  .live-card:hover {
    border-color: var(--faint);
  }
  .live-card.mobile {
    gap: 14px;
    padding: 12px;
  }
  .info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .live-card.mobile .info {
    gap: 6px;
  }
  .site {
    font-size: 14px;
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .live-card.mobile .site {
    font-size: 13px;
  }
  .player {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
  }
  .live-card.mobile .player {
    gap: 6px;
  }
  .disc {
    width: 10px;
    height: 10px;
    flex-shrink: 0;
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
  .name {
    flex: 1;
    min-width: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .clock {
    color: var(--muted);
  }
  .eval {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .track {
    flex: 1;
    min-width: 0;
  }
  .score {
    font-size: 12px;
    font-weight: 600;
  }
  .live-card.mobile .score {
    color: var(--text);
  }
  .spacer {
    flex: 1;
  }
  .foot {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    color: var(--muted);
  }
  .ellipsis {
    min-width: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .nowrap {
    white-space: nowrap;
  }
</style>
