import { createContext } from 'svelte';
import { MediaQuery } from 'svelte/reactivity';
import { empty } from './engines';
import type { EngineView } from './engines';
import type { GameStore } from './game.svelte';
import { KEYS, readNumber, writeNumber } from './storage';

export type Breakpoint = 'mobile' | 'tablet' | 'desktop' | 'large';
export type Side = 'white' | 'black';
/** Everything the headers show, built once in Viewer. */
export type HeaderInfo = {
  site: string;
  game: number | null;
  archive: boolean; // archive page or a replay: ARCHIVE badge, no LIVE / watching
  watching: number;
  others: number; // other live broadcasts (large desktop link)
};

export const MIN_BOARD = 320;
export const floor8 = (n: number): number => Math.floor(n / 8) * 8;
/** Board px within [MIN_BOARD, max], on Board's 8 px grid. */
export function clampBoard(px: number, max: number): number {
  return floor8(Math.max(MIN_BOARD, Math.min(px, max)));
}

export class ViewState {
  #tablet = new MediaQuery('min-width: 768px');
  #desktop = new MediaQuery('min-width: 1280px');
  #large = new MediaQuery('min-width: 1800px');

  flipped = $state(false);
  focus = $state(false);
  themeOpen = $state(false);
  /** Board px chosen with the resize handle (desktop/large only); null = fit automatically. */
  boardPref = $state<number | null>(readNumber(KEYS.boardWidth));

  get bp(): Breakpoint {
    if (this.#large.current) return 'large';
    if (this.#desktop.current) return 'desktop';
    return this.#tablet.current ? 'tablet' : 'mobile';
  }

  toggleFlip = (): void => {
    this.flipped = !this.flipped;
  };

  commitBoardPref(): void {
    if (this.boardPref != null) writeNumber(KEYS.boardWidth, this.boardPref);
  }
}

export const [getView, setView] = createContext<ViewState>();

/** "Game 111", or '' when unknown. No "of M": totalGames counts games played, not scheduled (amendment A2). */
export function gameText(info: HeaderInfo): string {
  return info.game == null ? '' : `Game ${info.game}`;
}

/** The kibitzer card's data; an empty card while the game has kibitzer data but not for this ply; null if none. */
export function kibitzerView(game: GameStore): EngineView | null {
  const g = game.game;
  if (!g || !game.engines) return null;
  if (game.engines.kibitzer) return game.engines.kibitzer;
  if (!g.kibitzerLiveData && !g.moves.some((m) => m.kibitzer)) return null;
  return empty('kibitzer', g.kibitzerLiveData?.name ?? 'Kibitzer');
}
