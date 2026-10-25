import { Chess } from 'chess.js';
import type { SerializedGame } from '$shared/types';
import { blendColors } from './color';

export type Arrow = { uci: string; color: string; opacity: number };
export type ArrowColors = { white: string; black: string; kibitzer: string };
export type ArrowSources = { kMove: string; fMove: string; tMove: string };

/** Browsing uses moves[index] (the search run from this position), also at index 0. */
export function arrowSources(game: SerializedGame, index: number, following: boolean): ArrowSources {
  if (following) {
    const last = game.moves[game.moves.length - 1];
    return {
      kMove: game.kibitzerLiveData?.pvAlg || '',
      fMove: last?.pvFollowup || '',
      tMove: game.liveData.pvAlg || '',
    };
  }
  const cur = game.moves[index];
  const prev = index > 0 ? game.moves[index - 1] : undefined;
  return { kMove: cur?.kibitzer?.pvAlg || '', fMove: prev?.pvFollowup || '', tMove: cur?.pvAlg || '' };
}

/**
 * Only moves legal in `fen` are kept (PVs go stale). The side to move's colour
 * goes on tMove, the other side's on its predicted reply fMove, kibitzer on kMove. One arrow per
 * distinct move (colours blended); later entries draw on top.
 */
export function buildArrows(fen: string, src: ArrowSources, colors: ArrowColors): Arrow[] {
  let chess: Chess;
  try {
    chess = new Chess(fen);
  } catch {
    return [];
  }
  const isLegal = (uci: string): boolean => {
    try {
      chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] || undefined });
      chess.undo();
      return true;
    } catch {
      return false;
    }
  };
  const whiteToMove = fen.split(' ')[1] !== 'b';
  const groups: { uci: string; colors: string[] }[] = [];
  const add = (uci: string, color: string) => {
    if (!uci || !isLegal(uci)) return;
    const g = groups.find((x) => x.uci === uci);
    if (g) g.colors.push(color);
    else groups.push({ uci, colors: [color] });
  };
  add(src.kMove, colors.kibitzer);
  add(src.fMove, whiteToMove ? colors.black : colors.white);
  add(src.tMove, whiteToMove ? colors.white : colors.black);
  return groups.map((g) => ({
    uci: g.uci,
    color: g.colors.length === 1 ? g.colors[0] : blendColors(g.colors),
    opacity: g.colors.length === 1 && g.uci === src.kMove ? 0.85 : 0.9,
  }));
}

/** Polygon points in an 800×800 viewBox (Board.dc.html:100-115). */
export function arrowPoints(uci: string, flipped: boolean): string {
  const center = (sq: string): [number, number] => {
    let f = sq.charCodeAt(0) - 97;
    let r = Number(sq[1]) - 1;
    if (flipped) {
      f = 7 - f;
      r = 7 - r;
    }
    return [f * 100 + 50, (7 - r) * 100 + 50];
  };
  const [x1, y1] = center(uci.slice(0, 2));
  const [x2, y2] = center(uci.slice(2, 4));
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  if (!len) return '';
  const ux = dx / len;
  const uy = dy / len;
  const [px, py] = [-uy, ux];
  const [sw, hw, hlen] = [9, 25, 38]; // half shaft, half head, head length
  const [tx, ty] = [x2 - ux * 8, y2 - uy * 8];
  const [bx, by] = [tx - ux * hlen, ty - uy * hlen];
  const pts = [
    [x1 + px * sw, y1 + py * sw],
    [bx + px * sw, by + py * sw],
    [bx + px * hw, by + py * hw],
    [tx, ty],
    [bx - px * hw, by - py * hw],
    [bx - px * sw, by - py * sw],
    [x1 - px * sw, y1 - py * sw],
  ];
  return pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
}
