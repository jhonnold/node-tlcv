<script lang="ts">
  type Props = { white: string; black: string; kibitzer: string | null; large?: boolean };
  const { white, black, kibitzer, large = false }: Props = $props();
</script>

<div class="legend" class:large>
  <span>Arrows</span>
  <span class="item"><span class="sw white"></span>{white}</span>
  <span class="item"><span class="sw black"></span>{black}</span>
  {#if kibitzer}
    <span class="item"><span class="sw kibitzer"></span>{kibitzer}</span>
  {/if}
</div>

<style>
  .legend {
    height: 36px;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: 6px 14px;
    font-size: 12px;
    color: var(--muted);
  }
  .legend.large {
    height: 38px;
    gap: 6px 16px;
  }
  .item {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  .sw {
    width: 14px;
    height: 4px;
  }
  .sw.white {
    background: var(--arrowW);
  }
  .sw.black {
    background: var(--arrowB);
  }
  .sw.kibitzer {
    background: var(--arrowK);
  }
</style>
