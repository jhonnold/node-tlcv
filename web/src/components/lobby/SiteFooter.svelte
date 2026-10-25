<script lang="ts">
  const { mobile }: { mobile: boolean } = $props();
</script>

<footer>
  <p>
    {#if !mobile}Chessboard by <a href="https://chessboardjs.com/">chessboard.js</a>. Pieces by
      <a href="https://en.wikipedia.org/wiki/User:Cburnett">Cburnett</a> and
      <a href="https://www.chessprogramming.org/Martin_Sedlak">Martin Sedlák</a>.
    {/if}Broadcasts by
    <a href="https://computerchess.org.uk/ccrl/4040/">CCRL</a>. Hosting and development by
    <a href="https://github.com/jhonnold">Jay Honnold</a>.{#if !mobile}
      Questions or ideas?
      <a href="https://github.com/jhonnold/node-tlcv/issues">Open an issue</a>.{/if}
  </p>
</footer>

<style>
  footer {
    margin-top: auto;
    border-top: 1px solid var(--line);
  }
  p {
    max-width: 1280px;
    margin: 0 auto;
    padding: 20px 32px;
    font-size: 12px;
    line-height: 1.6;
    color: var(--muted);
  }
  @media (max-width: 767px) {
    p {
      padding: 16px;
    }
  }
</style>
