// Chess piece sets. Orthogonal to the color theme: the chosen set is stored under its own
// key, so any set can be combined with any color palette.
//
// Sets live in web/public/img/pieces/<id>/<piece>.svg, where <piece> is the chessboardjs
// token (`wK`…`bP`).

export type PieceSetId = 'classic' | 'livius' | 'meridian' | 'meridian_shaded';

export interface PieceSetMeta {
  id: PieceSetId;
  label: string;
}

// Single source of truth for the dropdown and the apply logic. Classic first.
export const PIECE_SETS: PieceSetMeta[] = [
  { id: 'classic', label: 'Classic' },
  { id: 'livius', label: 'Livius' },
  { id: 'meridian', label: 'Meridian' },
  { id: 'meridian_shaded', label: 'Meridian Shaded' },
];

export const DEFAULT_PIECE_SET: PieceSetId = 'classic';

/** URL for one piece image in a set. `piece` is a chessboardjs token (e.g. `wK`). */
export function pieceSrc(set: PieceSetId, piece: string): string {
  return `/img/pieces/${set}/${piece}.svg`;
}

export function isPieceSetId(value: string | null): value is PieceSetId {
  return PIECE_SETS.some((s) => s.id === value);
}
