<script lang="ts">
  import { untrack } from 'svelte';
  import { lightsquare } from '@kibitzo/lightsquare';
  import type { Board, Options } from '@kibitzo/lightsquare';
  import '@kibitzo/lightsquare/lightsquare.css';
  import { arrowPoints } from '$lib/arrows';
  import type { Arrow } from '$lib/arrows';
  import type { LastMove } from '$lib/positions';
  import { pieceSrc } from '$lib/theme/piece-sets';
  import { theme } from '$lib/theme/theme.svelte';

  type Props = {
    fen: string;
    size: number;
    flipped?: boolean;
    coords?: boolean;
    lastMove?: LastMove | null;
    arrows?: Arrow[];
    animate?: boolean;
    label?: string;
  };
  const {
    fen,
    size,
    flipped = false,
    coords = true,
    lastMove = null,
    arrows = [],
    animate = true,
    label = 'Chess board',
  }: Props = $props();

  const px = $derived(Math.max(8, Math.floor(size / 8) * 8));
  const notation = $derived(coords && px >= 160); // Board.dc.html:64
  const coordPx = $derived(Math.max(9, Math.round(px / 48)));
  // Lightsquare draws each piece from a CSS variable (--ls-wk … --ls-bp), so a piece set is twelve URLs.
  const pieces = $derived(
    ['w', 'b']
      .flatMap((c) => [...'KQRBNP'].map((p) => `--ls-${c}${p.toLowerCase()}: url(${pieceSrc(theme.pieceSet, c + p)})`))
      .join('; '),
  );
  const state = $derived<Options>({
    position: fen,
    orientation: flipped ? 'black' : 'white',
    coordinates: notation,
    lastMove: lastMove ? [lastMove.from, lastMove.to] : null,
  });

  let host: HTMLDivElement;
  let board: Board | null = null;

  // One board per component. Lightsquare compares each new state with what is on screen and moves only the
  // pieces that changed; the slide itself is a CSS transition, so no script runs while a piece moves.
  $effect(() => {
    const b = untrack(() => lightsquare(host, state));
    board = b;
    return () => {
      b.destroy();
      board = null;
    };
  });
  $effect(() => {
    const [next, a] = [state, animate];
    untrack(() => board?.set(next, { animate: a }));
  });
</script>

<div
  class="board"
  role="img"
  aria-label={label}
  data-fen={fen}
  style="{pieces}; width: {px}px; height: {px}px; --coord: {coordPx}px"
>
  <div class="host" bind:this={host}></div>
  {#if arrows.length}
    <!-- The outline is theme-invariant (Board.dc.html:33). -->
    <svg viewBox="0 0 800 800" aria-hidden="true">
      {#each arrows as a (a.uci)}
        <polygon
          points={arrowPoints(a.uci, flipped)}
          fill={a.color}
          fill-opacity={a.opacity}
          stroke="#2E3440"
          stroke-opacity="0.6"
          stroke-width="3"
          stroke-linejoin="round"
        />
      {/each}
    </svg>
  {/if}
</div>

<style>
  .board {
    position: relative;
    overflow: hidden;
    flex-shrink: 0;
  }
  svg {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    /* Over the pieces: Lightsquare's layers stack up to z-index 8 inside its own stacking context. */
    z-index: 1;
  }
  /* Lightsquare's look is set through its CSS variables (lightsquare.css). */
  .host {
    width: 100%;
    --ls-light: var(--boardLight);
    --ls-dark: var(--boardDark);
    /* Board.dc.html:88: square mixed 55% toward the highlight. A 55% layer over the square gives the same colour. */
    --ls-last: color-mix(in srgb, var(--boardHl) 55%, transparent);
    --ls-coord-on-light: var(--boardDark);
    --ls-coord-on-dark: var(--boardLight);
    --ls-coord-font: var(--fontMono);
    --ls-coord-size: var(--coord);
    --ls-move-ms: 200ms;
  }
  /* Where the labels sat before: numbers 4% from the top and 6% from the left of their square, letters 4% from
     the bottom and 7% from the right (cqw is 1% of the board's width, so one square is 12.5cqw). */
  .host :global(.ls-coord) {
    padding: 0.5cqw 0.875cqw 0.5cqw 0.75cqw;
  }
</style>
