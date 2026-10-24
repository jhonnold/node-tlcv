<script lang="ts">
  import { formatScore } from '$lib/format';

  type Props = {
    score: number | null;
    orientation?: 'vertical' | 'horizontal';
    thickness?: number;
    flipped?: boolean;
    bordered?: boolean;
  };
  const { score, orientation = 'vertical', thickness = 12, flipped = false, bordered = true }: Props = $props();

  // Clamped to ±5 pawns; the white share of the bar (Main.dc.html:129).
  const whitePct = $derived(Math.round(50 + (Math.max(-5, Math.min(5, score ?? 0)) / 5) * 50));
  const aria = $derived(score == null ? 'Evaluation unavailable' : `Evaluation ${formatScore(score)} for White`);
</script>

{#if orientation === 'vertical'}
  <div class="bar vertical" class:bordered role="img" aria-label={aria} style:width="{thickness}px">
    <div class={flipped ? 'w' : 'b'} style:height="{flipped ? whitePct : 100 - whitePct}%"></div>
    <div class="{flipped ? 'b' : 'w'} fill"></div>
  </div>
{:else}
  <div class="bar horizontal" class:bordered role="img" aria-label={aria} style:height="{thickness}px">
    <div class="w" style:width="{whitePct}%"></div>
  </div>
{/if}

<style>
  .bar {
    display: flex;
    overflow: hidden;
    flex-shrink: 0;
    background: var(--evalB);
  }
  .bordered {
    border: 1px solid var(--line);
  }
  .vertical {
    flex-direction: column;
    align-self: stretch;
  }
  .horizontal {
    width: 100%;
  }
  .w {
    background: var(--evalW);
  }
  .b {
    background: var(--evalB);
  }
  .w,
  .b {
    transition:
      height 0.3s,
      width 0.3s;
  }
  .fill {
    flex: 1;
  }
</style>
