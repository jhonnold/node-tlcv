import { createContext } from 'svelte';
import type { GameRecord, ParsedResults } from '$shared/types';
import { getJson, HttpError } from './http';
import { apiBase } from './url';
import type { ViewerSource } from './url';

// The CT dump that carries results arrives a few seconds after a game ends (docs/protocol.md:47).
const REFRESH_DELAY_MS = 5000;

export class TournamentStore {
  games = $state.raw<GameRecord[] | null>(null);
  results = $state.raw<ParsedResults | null>(null);
  loading = $state(false);
  error = $state<string | null>(null);
  #source: ViewerSource;
  #ac: AbortController | null = null;
  #pending: Promise<void> | null = null;
  #timer: ReturnType<typeof setTimeout> | undefined;

  constructor(source: ViewerSource) {
    this.#source = source;
    void this.refresh();
  }

  /** Live: the last gameNumber + 1 (master plan §5). Archive: the latest game. During a replay, show game.replayNumber instead. */
  get currentGameNumber(): number | null {
    const g = this.games;
    if (!g) return null;
    const max = g.reduce((m, r) => Math.max(m, r.gameNumber), 0);
    return this.#source.kind === 'live' ? max + 1 : max || null;
  }
  /** Games PLAYED so far: the results footer "Total games = N" (src/services/result-parser.ts:91-104). Not the scheduled total. Standings show "N games played"; the header shows "Game N" with no total (A2). */
  get totalGames(): number | null {
    return this.results?.totalGames ?? null;
  }

  /** Re-fetches games and results. A 404 means "none yet" (→ null). Concurrent calls share one request. */
  refresh(): Promise<void> {
    this.#pending ??= this.#load().finally(() => {
      this.#pending = null;
    });
    return this.#pending;
  }

  /** Debounced refresh, for after a live game ends. */
  refreshSoon(delayMs = REFRESH_DELAY_MS): void {
    clearTimeout(this.#timer);
    this.#timer = setTimeout(() => void this.refresh(), delayMs);
  }

  dispose(): void {
    clearTimeout(this.#timer);
    this.#ac?.abort();
    this.#ac = null;
  }

  async #load(): Promise<void> {
    const ac = new AbortController();
    this.#ac = ac;
    this.loading = true;
    this.error = null;
    const base = apiBase(this.#source);
    const get = <T>(path: string): Promise<T | null> =>
      getJson<T>(`${base}${path}`, ac.signal).catch((e: unknown) => {
        if (e instanceof HttpError && e.status === 404) return null;
        throw e;
      });
    try {
      const [games, results] = await Promise.all([get<GameRecord[]>('/games'), get<ParsedResults>('/results')]);
      if (ac.signal.aborted) return;
      this.games = games;
      this.results = results;
    } catch (e) {
      if (!ac.signal.aborted) this.error = e instanceof Error ? e.message : String(e);
    } finally {
      if (this.#ac === ac) {
        this.#ac = null;
        this.loading = false;
      }
    }
  }
}

export const [getTournament, setTournament] = createContext<TournamentStore>();
