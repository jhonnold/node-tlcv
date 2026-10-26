import type { ColorCode, MoveMetaData, SerializedLiveData } from '$shared/types';
import { colorName, otherColor } from '$shared/colors';
import type { ColorName } from '$shared/colors';
import type { ClockState } from './clocks';
import { formatDuration, formatScore, moveScore, whiteScore } from './format';
import { moveLabel } from './positions';

/** Decision 2. */
export const isBook = (m: MoveMetaData): boolean => m.depth == null || (m.depth === 0 && !m.nodes);
export const prettyResult = (r: string): string => r.replaceAll('1/2', '½');

export type MoveCell = { kind: 'move'; ply: number; san: string; score: string; sub: string; label: string };
export type GhostCell = { kind: 'ghost'; color: ColorCode; number: number; san: string; score: string; sub: string };
export type Cell = MoveCell | GhostCell | { kind: 'empty' };
export type MoveRow = { num: number; cells: [Cell, Cell] };
const EMPTY: Cell = { kind: 'empty' };

function moveCell(m: MoveMetaData, ply: number): MoveCell {
  const book = isBook(m);
  return {
    kind: 'move',
    ply, // nav index: clicking calls game.goTo(ply)
    san: m.move,
    score: book || m.score == null ? '' : formatScore(moveScore(m)),
    sub: book ? 'book' : m.time != null ? `d${m.depth} · ${formatDuration(m.time * 1000)}` : `d${m.depth}`,
    label: `Go to ${moveLabel(m)}`,
  };
}

/** number | white | black rows. A black-first start leaves the first white cell empty. */
export function moveRows(moves: MoveMetaData[]): MoveRow[] {
  const rows: MoveRow[] = [];
  moves.forEach((m, i) => {
    let row = rows[rows.length - 1];
    if (!row || row.num !== m.number || m.color === 'w') {
      row = { num: m.number, cells: [EMPTY, EMPTY] };
      rows.push(row);
    }
    row.cells[m.color === 'w' ? 0 : 1] = moveCell(m, i + 1);
  });
  return rows;
}

/** The move being thought about. null when nobody is searching. */
export function ghostCell(
  moves: MoveMetaData[],
  ld: SerializedLiveData,
  clocks: Record<ColorName, ClockState> | null,
): GhostCell | null {
  const last = moves[moves.length - 1];
  const color = last ? otherColor(last.color) : ld.color;
  const thinkMs = clocks?.[colorName(color)].thinkMs ?? null;
  if (ld.depth <= 0 && thinkMs == null) return null;
  const number = last ? (last.color === 'w' ? last.number : last.number + 1) : ld.pvMoveNumber;
  const searching = ld.depth > 0 && ld.color === color;
  return {
    kind: 'ghost',
    color,
    number,
    san: searching && ld.pv.length ? ld.pv[0] : '…',
    score: searching ? formatScore(whiteScore(ld.score, ld.color)) : '',
    sub: thinkMs != null ? `thinking ${formatDuration(thinkMs)}` : 'thinking',
  };
}

/** Returns new rows: the ghost goes into the last row's empty black cell, or into a new row. Untouched rows keep their identity. */
export function placeGhost(rows: MoveRow[], g: GhostCell | null): MoveRow[] {
  if (!g) return rows;
  const last = rows[rows.length - 1];
  if (g.color === 'b' && last?.num === g.number && last.cells[1].kind === 'empty')
    return [...rows.slice(0, -1), { num: last.num, cells: [last.cells[0], g] }];
  return [...rows, { num: g.number, cells: g.color === 'w' ? [g, EMPTY] : [EMPTY, g] }];
}

/** ECO is a leading /^[A-E]\d\d/. */
export function splitOpening(opening: string): { eco: string; name: string } {
  const m = /^([A-E]\d\d)\b\s*(.*)$/.exec(opening.trim());
  return m ? { eco: m[1], name: m[2] } : { eco: '', name: opening.trim() };
}
