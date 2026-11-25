<script lang="ts">
  import Board from '../Board.svelte';
  import EvalBar from '../EvalBar.svelte';
  import { formatScore } from '$lib/format';
  import type { BoardSummary } from '$shared/types';
  import { clock, moveNumber } from '../lobby/lobby';

  type Props = { summary: BoardSummary; selected: boolean; onpick: () => void };
  const { summary: s, selected, onpick }: Props = $props();
  const move = $derived(moveNumber(s));
  const fen = $derived(s.fen);
</script>

<!-- A homepage LiveCard in compact form. The row's own markup is spans; Board and EvalBar render divs, which browsers
     accept inside a button. -->
<button
  type="button"
  class="row"
  class:selected
  aria-pressed={selected}
  aria-label="Board {s.board}: {s.white} vs {s.black}, move {move}"
  onclick={onpick}
>
  <Board {fen} size={88} coords={false} animate={false} label="{s.white} vs {s.black}" />
  <span class="info">
    <span class="head">
      <span class="ellipsis">Board {s.board}</span>
      <span class="nowrap">{s.viewerCount} watching</span>
    </span>
    <span class="player">
      <span class="disc black" aria-hidden="true"></span>
      <span class="name">{s.black}</span>
      <span class="clock mono">{clock(s.blackTime)}</span>
    </span>
    <span class="eval">
      <span class="track"><EvalBar score={s.score} orientation="horizontal" thickness={6} /></span>
      <span class="score mono">{formatScore(s.score)}</span>
    </span>
    <span class="player">
      <span class="disc white" aria-hidden="true"></span>
      <span class="name">{s.white}</span>
      <span class="clock mono">{clock(s.whiteTime)}</span>
    </span>
    <span class="foot">
      <span class="ellipsis">{s.opening}</span>
      <span class="nowrap">Move {move}</span>
    </span>
  </span>
</button>

<style>
  .row {
    width: 100%;
    display: flex;
    gap: 12px;
    box-sizing: border-box;
    padding: 10px 12px 10px 9px;
    border: 0;
    border-left: 3px solid transparent;
    border-bottom: 1px solid var(--line);
    background: transparent;
    color: var(--text);
    font: inherit;
    text-align: left;
    cursor: pointer;
  }
  .row:hover {
    background: var(--surface2);
  }
  .row.selected {
    background: var(--sel);
    border-left-color: var(--link);
  }
  .row:focus-visible {
    outline: 2px solid var(--link);
    outline-offset: -2px;
  }
  .info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 5px;
  }
  .head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    font-weight: 700;
  }
  .head .ellipsis {
    min-width: 0;
  }
  .player {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
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
    flex-shrink: 0;
    color: var(--muted);
  }
  .eval {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .track {
    flex: 1;
    min-width: 0;
  }
  .score {
    flex-shrink: 0;
    font-size: 12px;
    font-weight: 600;
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
    flex-shrink: 0;
    white-space: nowrap;
  }
</style>
