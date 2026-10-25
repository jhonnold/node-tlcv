<script lang="ts">
  import { onDestroy } from 'svelte';

  type Props = { size: number; min: number; max: number; onresize: (px: number) => void; oncommit: () => void };
  const { size, min, max, onresize, oncommit }: Props = $props();

  let start = $state<{ x: number; size: number } | null>(null);
  let lastX = 0;
  let frame = 0;

  function down(e: PointerEvent): void {
    if (e.button !== 0) return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    start = { x: e.clientX, size };
    lastX = e.clientX;
  }
  // Board.resize() rebuilds every square, so a burst of pointermoves becomes one resize per frame.
  function move(e: PointerEvent): void {
    if (!start) return;
    lastX = e.clientX;
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      if (start) onresize(start.size + lastX - start.x);
    });
  }
  function up(): void {
    if (!start) return;
    cancelAnimationFrame(frame);
    frame = 0;
    onresize(start.size + lastX - start.x);
    start = null;
    oncommit();
  }
  onDestroy(() => cancelAnimationFrame(frame));
</script>

<!-- Pointer-only: ←/→ always step moves, so the handle takes no keys and no focus. -->
<div
  class="handle"
  class:dragging={start !== null}
  role="separator"
  aria-orientation="vertical"
  aria-label="Resize board"
  aria-valuenow={size}
  aria-valuemin={min}
  aria-valuemax={max}
  onpointerdown={down}
  onpointermove={move}
  onpointerup={up}
  onpointercancel={up}
></div>

<style>
  .handle {
    width: 100%;
    height: 100%;
    cursor: col-resize;
    touch-action: none;
    display: flex;
    justify-content: center;
  }
  .handle::after {
    content: '';
    width: 2px;
    height: 100%;
    background: transparent;
  }
  .handle:hover::after {
    background: var(--line);
  }
  .handle.dragging::after {
    background: var(--link);
  }
</style>
