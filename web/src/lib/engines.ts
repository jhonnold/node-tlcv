import type { ColorCode, KibitzerMeta, MoveMetaData, SerializedGame, SerializedKibitzerLiveData } from '$shared/types';
import { colorName, otherColor } from '$shared/colors';
import { DASH, formatDuration, formatNodes, formatNps, formatScore, moveScore, npsSeconds, whiteScore } from './format';
import { EMPTY_PV, pvParts } from './pv';
import type { PvParts } from './pv';

export type EngineRole = 'white' | 'black' | 'kibitzer';
export type EngineView = {
  role: EngineRole;
  name: string;
  status: string; // 'Thinking…' | 'Expects 21. b3' | ''
  scoreValue: number | null;
  score: string;
  depth: string;
  nodes: string;
  nps: string;
  time: string;
  pv: PvParts;
  pvFen: string | null;
};
export type EngineViews = { white: EngineView; black: EngineView; kibitzer: EngineView | null };

export function empty(role: EngineRole, name: string, status = ''): EngineView {
  return {
    role,
    name,
    status,
    scoreValue: null,
    score: DASH,
    depth: DASH,
    nodes: DASH,
    nps: DASH,
    time: DASH,
    pv: EMPTY_PV,
    pvFen: null,
  };
}

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
    status: skip === 1 && pv.first ? `Expects ${pv.first}` : '',
    scoreValue: s,
    score: formatScore(s),
    depth: String(meta.depth),
    nodes: formatNodes(meta.nodes),
    nps: formatNps(meta.nodes, secs),
    time: secs != null ? formatDuration(secs * 1000) : DASH,
    pv,
    pvFen: meta.pvFen,
  };
}

/** The search in progress. */
function fromLive(game: SerializedGame, thinkMs: number | null): EngineView {
  const ld = game.liveData;
  const role = colorName(ld.color);
  const name = game[role].name;
  if (ld.depth <= 0) return empty(role, name, 'Thinking…');
  const s = whiteScore(ld.score, ld.color);
  return {
    role,
    name,
    status: 'Thinking…',
    scoreValue: s,
    score: formatScore(s),
    depth: String(ld.depth),
    nodes: formatNodes(ld.nodes),
    nps: formatNps(ld.nodes, ld.usedTime / 1000),
    time: formatDuration(thinkMs ?? ld.usedTime),
    pv: pvParts(ld.pv, ld.pvMoveNumber, ld.color, 0),
    pvFen: ld.pv.length ? ld.pvFen : null,
  };
}

/** The thread count is hidden, so status and NPS/Time stay empty. */
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

export function engineViews(
  game: SerializedGame,
  index: number,
  following: boolean,
  stm: ColorCode,
  thinkMs: number | null,
): EngineViews {
  const { moves } = game;
  if (following) {
    const thinker = game.liveData.color;
    const live = fromLive(game, thinkMs);
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
    kibitzer: cur?.kibitzer ? fromKibitzer('Kibitzer', cur.kibitzer) : null,
  };
}
