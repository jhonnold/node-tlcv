<script lang="ts">
  import { untrack } from 'svelte';
  import { arrowPoints } from '$lib/arrows';
  import type { Arrow } from '$lib/arrows';
  import { createBoard } from '$lib/chessboard';
  import type { ChessboardInstance } from '$lib/chessboard';
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

  let host: HTMLDivElement;
  let board: ChessboardInstance | null = null;

  function paintHighlight(): void {
    for (const el of host.querySelectorAll('.hl')) el.classList.remove('hl');
    if (!lastMove) return;
    for (const sq of [lastMove.from, lastMove.to]) host.querySelector(`[data-square="${sq}"]`)?.classList.add('hl');
  }

  // Every chessboardjs call runs untracked, so pieceTheme's read of theme.pieceSet is not a dependency here.
  $effect(() => {
    const showNotation = notation; // the only dependency: coords change → rebuild
    const { board: b, destroy } = untrack(() =>
      createBoard(host, {
        position: fen,
        orientation: flipped ? 'black' : 'white',
        showNotation,
        pieceTheme: (piece: string) => pieceSrc(theme.pieceSet, piece),
      }),
    );
    board = b;
    untrack(paintHighlight);
    return () => {
      destroy(); // also removes chessboardjs's leftover window/body handlers
      board = null;
    };
  });
  // resize() and orientation() rebuild every square, so the highlight is repainted after each.
  $effect(() => {
    void px;
    untrack(() => {
      board?.resize();
      paintHighlight();
    });
  });
  $effect(() => {
    const o = flipped ? 'black' : 'white';
    untrack(() => {
      if (!board || board.orientation() === o) return;
      board.orientation(o);
      paintHighlight();
    });
  });
  $effect(() => {
    const [f, a] = [fen, animate];
    untrack(() => board?.position(f, a));
  });
  // New piece set: redraw pieces in place (pieceTheme is consulted on every render).
  $effect(() => {
    void theme.pieceSet;
    untrack(() => board?.position(fen, false));
  });
  $effect(paintHighlight); // tracks lastMove only
</script>

<div
  class="board"
  role="img"
  aria-label={label}
  data-fen={fen}
  style:width="{px}px"
  style:height="{px}px"
  style:--coord="{coordPx}px"
>
  <!-- chessboardjs sizes squares from floor((width - 1) / 8), so the host is one pixel wider than the grid. -->
  <div class="host" bind:this={host} style:width="{px + 1}px"></div>
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
  }
  /* chessboardjs's class names are fixed (chessboard.js:199-216), so its markup is styled globally under .board. */
  .board :global(.board-b72b1) {
    border: 0;
  }
  .board :global(.white-1e1d7) {
    background: var(--boardLight);
    color: var(--boardDark);
  }
  .board :global(.black-3c85d) {
    background: var(--boardDark);
    color: var(--boardLight);
  }
  /* Board.dc.html:88: square mixed 55% toward the highlight */
  .board :global(.white-1e1d7.hl) {
    background: color-mix(in srgb, var(--boardHl) 55%, var(--boardLight));
  }
  .board :global(.black-3c85d.hl) {
    background: color-mix(in srgb, var(--boardHl) 55%, var(--boardDark));
  }
  .board :global(.notation-322f9) {
    font-family: var(--fontMono);
    font-size: var(--coord);
    font-weight: 600;
    line-height: 1;
  }
  .board :global(.numeric-fc462) {
    top: 4%;
    left: 6%;
  }
  .board :global(.alpha-d2270) {
    bottom: 4%;
    right: 7%;
  }
</style>
