import type { ColorCode, KibitzerMeta, MoveMetaData, SerializedGame, SerializedKibitzerLiveData } from '$shared/types';
import { colorName, otherColor } from '$shared/colors';
import {
  DASH,
  formatCount,
  formatNodes,
  formatNps,
  formatScore,
  moveScore,
  npsSeconds,
  whiteScore,
  whiteWdl,
} from './format';
import { EMPTY_PV, pvParts } from './pv';
import type { PvParts } from './pv';

export type EngineRole = 'white' | 'black' | 'kibitzer';
export type EngineView = {
  role: EngineRole;
  name: string;
  scoreValue: number | null;
  score: string;
  depth: string;
  // Each null when not sent (archives, kibitzer, a search without WINFO); the card drops it from its stats row.
  seldepth: string | null;
  nodes: string;
  nps: string;
  hashfull: string | null; // '21.4%'
  tbhits: string | null;
  // Permille, White's view. Null when not sent.
  wdl: [number, number, number] | null;
  pv: PvParts;
  pvFen: string | null;
};
export type EngineViews = { white: EngineView; black: EngineView; kibitzer: EngineView | null };

export function empty(role: EngineRole, name: string): EngineView {
  return {
    role,
    name,
    scoreValue: null,
    score: DASH,
    depth: DASH,
    seldepth: null,
    nodes: DASH,
    nps: DASH,
    hashfull: null,
    tbhits: null,
    wdl: null,
    pv: EMPTY_PV,
    pvFen: null,
  };
}

const hashText = (permille: number | null | undefined): string | null =>
  permille == null ? null : `${(permille / 10).toFixed(1)}%`;
const tbText = (n: number | null | undefined): string | null => (n == null ? null : formatCount(n));
const seldText = (n: number | null | undefined): string | null => (n == null ? null : String(n));

/** A finished search. Book moves have no depth and render as empty. */
function fromMeta(game: SerializedGame, color: ColorCode, meta: MoveMetaData | undefined, skip: 0 | 1): EngineView {
  const role = colorName(color);
  if (!meta || meta.color !== color || meta.depth == null) return empty(role, game[role].name);
  const secs = npsSeconds(meta);
  const pv = pvParts(meta.pv, meta.pvMoveNumber ?? meta.number, meta.color, skip);
  const s = moveScore(meta);
  return {
    role,
    name: game[role].name,
    scoreValue: s,
    score: formatScore(s, meta.mate),
    depth: String(meta.depth),
    seldepth: seldText(meta.seldepth),
    nodes: formatNodes(meta.nodes),
    nps: formatNps(meta.nodes, secs),
    hashfull: hashText(meta.hashfull),
    tbhits: tbText(meta.tbhits),
    wdl: meta.wdl ? whiteWdl(meta.wdl, meta.color) : null,
    pv,
    pvFen: meta.pvFen,
  };
}

/** The search in progress. */
function fromLive(game: SerializedGame): EngineView {
  const ld = game.liveData;
  const role = colorName(ld.color);
  const name = game[role].name;
  if (ld.depth <= 0) return empty(role, name);
  const s = whiteScore(ld.score, ld.color);
  return {
    role,
    name,
    scoreValue: s,
    score: formatScore(s, ld.mate),
    depth: String(ld.depth),
    seldepth: seldText(ld.seldepth),
    nodes: formatNodes(ld.nodes),
    nps: formatNps(ld.nodes, ld.usedTime / 1000),
    hashfull: hashText(ld.hashfull),
    tbhits: tbText(ld.tbhits),
    wdl: ld.wdl ? whiteWdl(ld.wdl, ld.color) : null,
    pv: pvParts(ld.pv, ld.pvMoveNumber, ld.color, 0),
    pvFen: ld.pv.length ? ld.pvFen : null,
  };
}

/** The kibitzer sends no WINFO extras or NPS, so those stay empty. */
function fromKibitzer(name: string, k: KibitzerMeta | SerializedKibitzerLiveData): EngineView {
  return {
    ...empty('kibitzer', name),
    scoreValue: k.score,
    score: formatScore(k.score),
    depth: String(k.depth),
    nodes: formatNodes(k.nodes),
    pv: pvParts(k.pv, k.pvMoveNumber ?? 1, k.stm, 0),
    pvFen: k.pv?.length ? k.pvFen : null,
  };
}

export function engineViews(game: SerializedGame, index: number, following: boolean, stm: ColorCode): EngineViews {
  const { moves } = game;
  if (following) {
    const thinker = game.liveData.color;
    const live = fromLive(game);
    const waiting = fromMeta(game, otherColor(thinker), moves[moves.length - 1], 1);
    const k = game.kibitzerLiveData;
    return {
      white: thinker === 'w' ? live : waiting,
      black: thinker === 'w' ? waiting : live,
      kibitzer: k ? fromKibitzer(k.name, k) : null,
    };
  }
  const cur = moves[index];
  const toMove = fromMeta(game, stm, cur, 0);
  const moved = fromMeta(game, otherColor(stm), index > 0 ? moves[index - 1] : undefined, 1);
  return {
    white: stm === 'w' ? toMove : moved,
    black: stm === 'w' ? moved : toMove,
    kibitzer: cur?.kibitzer ? fromKibitzer(game.kibitzerLiveData?.name ?? 'Kibitzer', cur.kibitzer) : null,
  };
}
