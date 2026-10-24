<script lang="ts">
  import { getGameStore } from '$lib/game.svelte';
  import { prettyResult } from '$lib/moves';
  import type { ViewerSource } from '$lib/url';

  type Props = { source: ViewerSource };
  const { source }: Props = $props();
  const game = getGameStore();
</script>

{#if game.isReplay && game.replayMeta}
  {@const m = game.replayMeta}
  <div class="replay-banner">
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"><polygon points="6 4 20 12 6 20 6 4"></polygon></svg
    >
    <div class="text">
      <div class="title">Replaying game {game.replayNumber}</div>
      <div class="sub">
        {m.white.name} – {m.black.name} · {prettyResult(m.result)} · {Math.ceil(m.moves.length / 2)} moves
      </div>
    </div>
    {#if source.kind === 'live'}
      <button type="button" class="back" onclick={() => game.exitReplay()}>Back to live</button>
    {/if}
  </div>
{/if}

<style>
  .replay-banner {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 14px;
    background: var(--surface2);
    border-bottom: 1px solid var(--line);
  }
  .text {
    flex: 1;
    min-width: 0;
  }
  .title {
    font-size: 13px;
    font-weight: 600;
  }
  .sub {
    font-size: 12px;
    color: var(--muted);
  }
  .back {
    height: 32px;
    padding: 0 12px;
    display: inline-flex;
    align-items: center;
    border: 0;
    background: var(--invBg);
    color: var(--invText);
    font-size: 12px;
    font-weight: 700;
  }
</style>
