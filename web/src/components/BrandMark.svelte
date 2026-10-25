<script lang="ts">
  const { size = 24 }: { size?: number } = $props();
</script>

<svg class="mark" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
  <rect x="3" y="3" width="8" height="8" fill="currentColor" />
  <rect x="13" y="13" width="8" height="8" fill="currentColor" />
  <rect x="13.75" y="3.75" width="6.5" height="6.5" fill="none" stroke="currentColor" stroke-width="1.5" />
  <rect x="3.75" y="13.75" width="6.5" height="6.5" fill="none" stroke="currentColor" stroke-width="1.5" />
</svg>

<style>
  .mark {
    flex-shrink: 0;
  }
</style>
