// chessboard.ts — the only module that imports chessboardjs.
import './jquery-global';
import jQuery from 'jquery';
import Chessboard from 'chessboardjs';
import type { ChessboardConfig, ChessboardInstance } from 'chessboardjs';
import 'chessboardjs/www/css/chessboard.css';

export type { ChessboardInstance };

type HandleObj = { handler: (...args: unknown[]) => unknown };
type Bound = { target: Window | HTMLElement; type: string; handler: HandleObj['handler'] };
// jQuery's internal event registry (undocumented, stable since 1.x); not in @types/jquery.
const events = (target: Window | HTMLElement): Record<string, HandleObj[]> | undefined =>
  (jQuery as unknown as { _data(el: unknown, key: 'events'): Record<string, HandleObj[]> | undefined })._data(
    target,
    'events',
  );

function globalHandlers(): Bound[] {
  const out: Bound[] = [];
  for (const target of [window, document.body]) {
    for (const [type, list] of Object.entries(events(target) ?? {})) {
      for (const h of list) out.push({ target, type, handler: h.handler });
    }
  }
  return out;
}

/**
 * Build a board and return it with a destroy that also removes what chessboardjs's own destroy()
 * leaves behind: its un-namespaced `$(window)` / `$('body')` handlers (chessboard.js:1621-1655).
 * Each handler is a closure unique to the instance, so the ones this call added are found by diffing.
 */
export function createBoard(
  container: HTMLElement,
  config: ChessboardConfig,
): { board: ChessboardInstance; destroy: () => void } {
  const before = globalHandlers();
  const board = Chessboard(container, config);
  const added = globalHandlers().filter(
    (h) => !before.some((b) => b.target === h.target && b.type === h.type && b.handler === h.handler),
  );
  return {
    board,
    destroy: () => {
      board.destroy();
      for (const h of added) jQuery(h.target).off(h.type, h.handler);
    },
  };
}
