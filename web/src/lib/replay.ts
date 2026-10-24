import type { GameRecord, StoredGameMeta } from '$shared/types';
import { getJson } from './http';
import type { GameData } from './delta';
import { EMPTY_FEN } from './fen';
import type { ViewerSource } from './url';
import { apiBase } from './url';

/** A saved game shaped like a live broadcast, so the same components can render it. */
export function metaToGameData(meta: StoredGameMeta): GameData {
  return {
    game: {
      site: meta.site,
      white: { name: meta.white.name, clockTime: 0, startTime: 0 },
      black: { name: meta.black.name, clockTime: 0, startTime: 0 },
      liveData: {
        color: 'w',
        depth: 0,
        score: 0,
        nodes: 0,
        usedTime: 0,
        pv: [],
        pvAlg: '',
        pvFen: EMPTY_FEN,
        pvMoveNumber: 1,
      },
      fen: meta.fen,
      opening: meta.opening,
      tablebase: '',
      stm: meta.stm,
      moves: meta.moves,
      startFen: meta.startFen,
      kibitzerLiveData: null,
    },
    spectators: [],
    menu: {},
  };
}

export function loadReplayGame(
  source: ViewerSource,
  gameNumber: number,
  signal?: AbortSignal,
): Promise<StoredGameMeta> {
  return getJson<StoredGameMeta>(`${apiBase(source)}/games/${gameNumber}`, signal);
}

/** Archive pages open on the most recent finished game, so they don't land on a blank board. */
export async function loadLatestReplay(
  source: ViewerSource,
  signal?: AbortSignal,
): Promise<{ gameNumber: number; meta: StoredGameMeta } | null> {
  const games = await getJson<GameRecord[]>(`${apiBase(source)}/games`, signal);
  const latest = games
    .filter((g) => g.metaUrl)
    .reduce<GameRecord | null>((best, g) => (!best || g.gameNumber > best.gameNumber ? g : best), null);
  if (!latest) return null;
  return { gameNumber: latest.gameNumber, meta: await loadReplayGame(source, latest.gameNumber, signal) };
}
