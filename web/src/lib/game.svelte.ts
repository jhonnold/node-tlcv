import { createContext } from 'svelte';
import { io, type Socket } from 'socket.io-client';
import type { BroadcastDelta, ColorCode, SerializedBroadcast, StoredGameMeta } from '$shared/types';
import type { ColorName } from '$shared/colors';
import { theme } from './theme/theme.svelte';
import { KEYS, readString } from './storage';
import { START_FEN } from './fen';
import { msToString } from './format';
import { applyDelta } from './delta';
import type { GameData } from './delta';
import { metaToGameData } from './replay';
import { buildPositions, fenAt, lastMoveAt, positionLabel } from './positions';
import { liveClocks, lastMoveMs } from './clocks';
import { arrowSources, buildArrows } from './arrows';
import type { Arrow } from './arrows';
import { engineViews } from './engines';
import { playMoveSound } from './sounds.svelte';

export type PlayerView = {
  name: string;
  clock: string;
  active: boolean;
  thinkMs: number | null;
  lastMs: number | null;
  score: string | null;
};

const TICK_MS = 250;
const EDITABLE = ['INPUT', 'TEXTAREA', 'SELECT']; // array, not Set (lint)

export class GameStore {
  #live = $state.raw<GameData | null>(null);
  #replay = $state.raw<StoredGameMeta | null>(null);
  #socket: Socket | null = null;

  chat = $state.raw<string[]>([]);
  connected = $state(false);
  cursor = $state<number | null>(null); // null follows the latest position
  now = $state(Date.now());
  // Changes only through loadReplay() and exitReplay().
  replayNumber = $state<number | null>(null);

  live = $derived(this.#live); // the live broadcast even during a replay (spectators, menu)
  isReplay = $derived(this.#replay !== null);
  replayMeta = $derived(this.#replay);
  data = $derived(this.#replay ? metaToGameData(this.#replay) : this.#live);
  game = $derived(this.data?.game ?? null);
  moves = $derived(this.game?.moves ?? []);
  length = $derived(this.moves.length);
  // Joined string: a retroactive PV patch (new array, same SANs) must not replay the game in chess.js.
  #sans = $derived(this.moves.map((m) => m.move).join(' '));
  positions = $derived(buildPositions(this.game?.startFen ?? null, this.#sans ? this.#sans.split(' ') : []));
  index = $derived(this.cursor === null ? this.length : Math.min(this.cursor, this.length));
  following = $derived(!this.isReplay && this.index === this.length);
  fen = $derived(fenAt(this.positions, this.index, this.game?.fen ?? START_FEN));
  lastMove = $derived(lastMoveAt(this.positions, this.index));
  moveMeta = $derived(this.index > 0 ? (this.moves[this.index - 1] ?? null) : null);
  sideToMove = $derived<ColorCode>(this.fen.split(' ')[1] === 'b' ? 'b' : 'w');
  label = $derived(positionLabel(this.moves, this.index, this.following));
  clocks = $derived(this.game ? liveClocks(this.game, this.now) : null);
  #thinkMs = $derived(this.following && this.clocks ? (this.clocks.white.thinkMs ?? this.clocks.black.thinkMs) : null);
  engines = $derived(
    this.game ? engineViews(this.game, this.index, this.following, this.sideToMove, this.#thinkMs) : null,
  );
  arrows = $derived<Arrow[]>(
    this.game
      ? buildArrows(this.fen, arrowSources(this.game, this.index, this.following), {
          white: theme.colors.arrowW,
          black: theme.colors.arrowB,
          kibitzer: theme.colors.arrowK,
        })
      : [],
  );
  evalScore = $derived.by(() => {
    const e = this.engines;
    if (!e) return null;
    const mine = this.sideToMove === 'w' ? e.white : e.black;
    const theirs = this.sideToMove === 'w' ? e.black : e.white;
    return mine.scoreValue ?? theirs.scoreValue;
  });
  players = $derived.by(() => {
    const { game, engines, clocks, moves, index, sideToMove, following } = this;
    if (!game || !engines) return null;
    const view = (c: ColorCode): PlayerView => {
      const side: ColorName = c === 'w' ? 'white' : 'black';
      const live = following ? (clocks?.[side] ?? null) : null;
      const e = engines[side];
      return {
        name: game[side].name,
        clock: live ? msToString(live.remainingMs) : '--:--',
        active: sideToMove === c,
        thinkMs: live?.thinkMs ?? null,
        lastMs: lastMoveMs(moves, index, c),
        score: e.scoreValue == null ? null : e.score,
      };
    };
    return { white: view('w'), black: view('b') };
  });

  // ---- navigation -----------------------------------------------------------

  /** Clamps to [0, length]. Reaching the end of a live game re-follows the broadcast. */
  goTo(i: number): void {
    const c = Math.max(0, Math.min(i, this.length));
    this.cursor = c === this.length && !this.isReplay ? null : c;
  }

  first = (): void => this.goTo(0);
  prev = (): void => this.goTo(this.index - 1);
  next = (): void => this.goTo(this.index + 1);
  latest = (): void => this.goTo(this.length);

  // Alt, Ctrl and Meta chords are ignored (one check covers all four arrow keys).
  onKeydown = (e: KeyboardEvent): void => {
    const el = document.activeElement;
    if (el && (EDITABLE.includes(el.tagName) || (el instanceof HTMLElement && el.isContentEditable))) return;
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    let action: (() => void) | null = null;
    switch (e.key) {
      case 'ArrowLeft':
        action = this.prev;
        break;
      case 'ArrowRight':
        action = this.next;
        break;
      case 'ArrowUp':
        action = this.first;
        break;
      case 'ArrowDown':
        action = this.latest;
        break;
    }
    if (!action) return;
    e.preventDefault();
    action();
  };

  // ---- live connection ------------------------------------------------------

  /** Connects to a broadcast port. Returns the disconnect function. */
  connect(port: number): () => void {
    const socket = io({ autoConnect: false });
    this.#socket = socket;
    socket.on('connect', () => {
      this.connected = true;
      socket.emit('join', { port, user: readString(KEYS.username) || 'Anonymous' });
    });
    socket.on('disconnect', () => {
      this.connected = false;
    });
    socket.on('state', (data: SerializedBroadcast) => {
      const { chat, ...rest } = data;
      this.#live = rest;
      this.chat = chat;
      if (!this.#replay) this.cursor = null; // full sync re-follows live, but never disturbs a replay
    });
    socket.on('update', (delta: BroadcastDelta) => {
      const prev = this.#live;
      if (!prev) return;
      const next = applyDelta(prev, delta);
      this.#live = next;
      if (this.#replay) return; // merged in the background; no cursor change or sound during a replay
      // A new game arrives as a delta with resetMoves (src/game-service.ts:577,602), not as `state`: re-follow live.
      if (delta.game?.resetMoves) this.cursor = null;
      const moves = next.game.moves;
      if (moves.length > prev.game.moves.length) playMoveSound(moves[moves.length - 1].move);
    });
    socket.on('new-chat', (msgs: string[]) => {
      this.chat = [...this.chat, ...msgs];
    });
    const tick = setInterval(() => {
      this.now = Date.now();
    }, TICK_MS);
    socket.connect();
    return () => {
      clearInterval(tick);
      socket.removeAllListeners();
      socket.disconnect();
      this.#socket = null;
      this.connected = false;
    };
  }

  send(event: 'chat' | 'nick', payload: string): void {
    this.#socket?.emit(event, payload);
  }

  // ---- replay ---------------------------------------------------------------

  loadReplay(meta: StoredGameMeta, gameNumber: number): void {
    this.#replay = meta;
    this.replayNumber = gameNumber;
    this.cursor = 0;
  }

  exitReplay(): void {
    this.#replay = null;
    this.replayNumber = null;
    this.cursor = null;
  }
}

export const [getGameStore, setGameStore] = createContext<GameStore>();
