<script lang="ts">
  import Board from '../Board.svelte';
  import EvalBar from '../EvalBar.svelte';
  import { formatScore } from '$lib/format';
  import type { LobbyBroadcast } from '$shared/types';
  import { cardLabel, clock, moveNumber, title, whiteToMove } from './lobby';

  type Props = { b: LobbyBroadcast; mobile: boolean; size: number };
  const { b, mobile, size }: Props = $props();
  const wtm = $derived(whiteToMove(b));
  const move = $derived(moveNumber(b));
</script>

{#snippet player(side: 'white' | 'black')}
  {@const active = (side === 'white') === wtm}
  <div class="player">
    <span class="disc" class:white={side === 'white'} class:black={side === 'black'} aria-hidden="true"></span>
    <span class="name">{side === 'white' ? b.white : b.black}</span>
    <span class="clock mono" class:active>{clock(side === 'white' ? b.whiteTime : b.blackTime)}</span>
  </div>
{/snippet}

{#snippet evalRow()}
  <div class="eval">
    <div class="track"><EvalBar score={b.score} orientation="horizontal" thickness={mobile ? 6 : 8} /></div>
    <span class="score mono">{formatScore(b.score)}</span>
  </div>
{/snippet}

<a class="featured" class:mobile href="/{b.port}" data-port={b.port} aria-label={cardLabel(b)}>
  {#if mobile}
    <div class="top">
      <span class="live-pill"><span class="pill-dot"></span>LIVE</span>
      <span class="site">{title(b)}</span>
    </div>
    {@render player('black')}
    <Board fen={b.fen} {size} coords={false} label="{b.white} vs {b.black}" />
    {@render player('white')}
    {@render evalRow()}
    <div class="meta">
      <span class="ellipsis">{b.opening ? `${b.opening} · ` : ''}Move {move}</span>
      <span>{b.viewerCount} watching</span>
    </div>
  {:else}
    <Board fen={b.fen} {size} coords={false} label="{b.white} vs {b.black}" />
    <div class="info">
      <div class="top">
        <span class="live-pill"><span class="pill-dot"></span>LIVE</span>
        <span class="most">Most watched</span>
      </div>
      <div>
        <div class="title">{title(b)}</div>
        {#if b.opening}<div class="sub">{b.opening}</div>{/if}
      </div>
      <div class="players">
        {@render player('black')}
        {@render evalRow()}
        {@render player('white')}
      </div>
      <div class="spacer"></div>
      <div class="foot">
        <span>Move {move}</span>
        <span class="watchers">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
            ><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg
          >
          {b.viewerCount} watching
        </span>
        <span class="spacer"></span>
        <span class="watch">Watch</span>
      </div>
    </div>
  {/if}
</a>

<style>
  .featured {
    display: grid;
    grid-template-columns: 380px minmax(0, 1fr);
    gap: 32px;
    padding: 20px;
    border: 1px solid var(--line);
    background: var(--surface);
    color: var(--text);
    text-decoration: none;
  }
  .featured:hover {
    border-color: var(--faint);
  }
  .featured.mobile {
    display: flex;
    flex-direction: column;
    gap: 14px;
    padding: 16px;
  }
  .info {
    display: flex;
    flex-direction: column;
    gap: 18px;
    padding: 4px 0;
    min-width: 0;
  }
  .top {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .live-pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 24px;
    padding: 0 10px;
    background: var(--liveBg);
    color: #fff;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.08em;
  }
  .pill-dot {
    width: 6px;
    height: 6px;
    background: currentColor;
  }
  .most {
    font-size: 13px;
    color: var(--muted);
  }
  .title {
    font-size: 24px;
    font-weight: 700;
    letter-spacing: -0.01em;
  }
  .sub {
    margin-top: 4px;
    font-size: 14px;
    color: var(--muted);
  }
  .players {
    display: flex;
    flex-direction: column;
    gap: 10px;
    max-width: 560px;
  }
  .player {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .disc {
    width: 14px;
    height: 14px;
    flex-shrink: 0;
    border: 1.5px solid;
  }
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
    font-size: 18px;
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .clock {
    padding: 2px 8px;
    font-size: 18px;
    color: var(--muted);
  }
  .clock.active {
    background: var(--invBg);
    color: var(--invText);
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
    width: 52px;
    text-align: right;
    font-size: 14px;
    font-weight: 600;
  }
  .spacer {
    flex: 1;
  }
  .foot {
    display: flex;
    align-items: center;
    gap: 20px;
    font-size: 14px;
    color: var(--muted);
  }
  .watchers {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  .watch {
    height: 44px;
    display: inline-flex;
    align-items: center;
    padding: 0 20px;
    background: var(--invBg);
    color: var(--invText);
    font-size: 15px;
    font-weight: 700;
  }
  .featured.mobile .top {
    gap: 8px;
  }
  .featured.mobile .live-pill {
    height: 22px;
    padding: 0 8px;
  }
  .featured.mobile .site {
    flex: 1;
    min-width: 0;
    font-size: 15px;
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .featured.mobile .player {
    gap: 10px;
    font-size: 15px;
  }
  .featured.mobile .disc {
    width: 12px;
    height: 12px;
  }
  .featured.mobile .name {
    font-size: 15px;
  }
  .featured.mobile .clock {
    padding: 1px 6px;
    font-size: 15px;
  }
  .featured.mobile .eval {
    gap: 10px;
  }
  .featured.mobile .score {
    width: auto;
    font-size: 13px;
  }
  .featured.mobile .meta {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    font-size: 13px;
    color: var(--muted);
  }
  .featured.mobile .ellipsis {
    min-width: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  @media (max-width: 1023px) {
    .featured {
      gap: 24px;
    }
  }
</style>
