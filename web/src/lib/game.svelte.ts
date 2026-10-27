import { createContext, untrack } from 'svelte';
import { io, type Socket } from 'socket.io-client';
import type { BroadcastDelta, ColorCode, SerializedBroadcast, SerializedGame, StoredGameMeta } from '$shared/types';
import { colorName, otherColor } from '$shared/colors';
import { theme } from './theme/theme.svelte';
import { KEYS, readString } from './storage';
import { START_FEN } from './fen';
import { msToString } from './format';
import { applyDelta } from './delta';
import type { GameData } from './delta';
import { metaToGameData } from './replay';
import { buildPositions, fenAt, lastMoveAt, positionLabel } from './positions';
import { liveClocks, lastMoveMs } from './clocks';
import type { TurnEnd } from './clocks';
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
const CHAT_LIMIT = 2000; // the server keeps this many lines (src/broadcast.ts:28)
const CHAT_SLACK = 200; // trim in batches, so the keyed chat list isn't re-indexed on every message
const trimChat = (lines: string[]): string[] =>
  lines.length > CHAT_LIMIT + CHAT_SLACK ? lines.slice(-CHAT_LIMIT) : lines;
const EDITABLE = ['INPUT', 'TEXTAREA', 'SELECT']; // array, not Set (lint)

export class GameStore {
  #live = $state.raw<GameData | null>(null);
  #replay = $state.raw<{ meta: StoredGameMeta; number: number } | null>(null);
  #socket: Socket | null = null;
  // Keyed by side, set when that side's turn ends. Plain, not state: it always changes together with #live.
  #turnEnd: Partial<Record<ColorCode, TurnEnd>> = {};
  #gen = $state(0); // replay generation: bumped by beginReplay and exitReplay

  chat = $state.raw<string[]>([]);
  connected = $state(false);
  cursor = $state<number | null>(null); // null follows the latest position
  now = $state(Date.now());

  /** The live broadcast even during a replay (spectators, menu). */
  get live(): GameData | null {
    return this.#live;
  }
  get replayMeta(): StoredGameMeta | null {
    return this.#replay?.meta ?? null;
  }
  get replayNumber(): number | null {
    return this.#replay?.number ?? null;
  }

  /** The current replay generation. A pending load compares its gen against this. */
  get replayGen(): number {
    return this.#gen;
  }

  isReplay = $derived(this.#replay !== null);
  data = $derived(this.#replay ? metaToGameData(this.#replay.meta) : this.#live);
  game = $derived(this.data?.game ?? null);
  moves = $derived(this.game?.moves ?? []);
  length = $derived(this.moves.length);
  // Joined string: a retroactive PV patch (new array, same SANs) must not replay the game in chess.js.
  #sans = $derived(this.moves.map((m) => m.move).join(' '));
  // A string, so positions don't rebuild on every delta (the game object changes each time).
  #startFen = $derived(this.game?.startFen ?? null);
  positions = $derived(buildPositions(this.#startFen, this.#sans ? this.#sans.split(' ') : []));
  index = $derived(this.cursor === null ? this.length : Math.min(this.cursor, this.length));
  following = $derived(!this.isReplay && this.index === this.length);
  fen = $derived(fenAt(this.positions, this.index, this.game?.fen ?? START_FEN));
  lastMove = $derived(lastMoveAt(this.positions, this.index));
  moveMeta = $derived(this.index > 0 ? (this.moves[this.index - 1] ?? null) : null);
  sideToMove = $derived<ColorCode>(this.fen.split(' ')[1] === 'b' ? 'b' : 'w');
  label = $derived(positionLabel(this.moves, this.index, this.following));
  clocks = $derived(this.game ? liveClocks(this.game, this.now, this.#turnEnd) : null);
  engines = $derived(this.game ? engineViews(this.game, this.index, this.following, this.sideToMove) : null);
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
    return e[colorName(this.sideToMove)].scoreValue ?? e[colorName(otherColor(this.sideToMove))].scoreValue;
  });
  players = $derived.by(() => {
    const { game, engines, clocks, moves, index, sideToMove, following } = this;
    if (!game || !engines) return null;
    const view = (c: ColorCode): PlayerView => {
      const side = colorName(c);
      const live = following ? (clocks?.[side] ?? null) : null;
      const e = engines[side];
      return {
        name: game[side].name,
        clock: live && game[side].clockTime > 0 ? msToString(live.remainingMs) : '--:--',
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

  #keys: Record<string, () => void> = {
    ArrowLeft: this.prev,
    ArrowRight: this.next,
    ArrowUp: this.first,
    ArrowDown: this.latest,
  };

  // Alt, Ctrl and Meta chords are ignored (one check covers all four arrow keys).
  onKeydown = (e: KeyboardEvent): void => {
    const el = document.activeElement;
    if (el && (EDITABLE.includes(el.tagName) || (el instanceof HTMLElement && el.isContentEditable))) return;
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const action = this.#keys[e.key];
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
      this.#turnEnd = {};
      this.#live = rest;
      this.chat = trimChat(chat);
      if (!this.#replay) this.cursor = null; // full sync re-follows live, but never disturbs a replay
    });
    socket.on('update', (delta: BroadcastDelta) => {
      const prev = this.#live;
      if (!prev) return;
      const next = applyDelta(prev, delta);
      if (delta.game?.resetMoves) this.#turnEnd = {};
      else if (next.game.stm !== prev.game.stm) this.#recordTurnEnd(prev.game, next.game);
      this.#live = next;
      if (this.#replay) return; // merged in the background; no cursor change or sound during a replay
      // A new game arrives as a delta with resetMoves (src/game-service.ts:577,602), not as `state`: re-follow live.
      if (delta.game?.resetMoves) this.cursor = null;
      const moves = next.game.moves;
      if (moves.length > prev.game.moves.length) playMoveSound(moves[moves.length - 1].move);
    });
    socket.on('new-chat', (msgs: string[]) => {
      this.chat = trimChat([...this.chat, ...msgs]);
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

  /** The side that just finished its turn keeps the clock it had, so the new mover's stale clock can be bounded. */
  #recordTurnEnd(before: SerializedGame, after: SerializedGame): void {
    const side = colorName(before.stm);
    this.#turnEnd[before.stm] = {
      clockTime: before[side].clockTime,
      remainingMs: liveClocks(after, 0)[side].remainingMs,
    };
  }

  send(event: 'chat' | 'nick', payload: string): void {
    this.#socket?.emit(event, payload);
  }

  // ---- replay ---------------------------------------------------------------

  /** Starts a replay generation. Call it before fetching, and pass the result to loadReplay. */
  beginReplay(): number {
    return untrack(() => ++this.#gen);
  }

  /** Applies a replay unless `gen` is given and is no longer the latest. Returns whether it applied. */
  loadReplay(meta: StoredGameMeta, gameNumber: number, gen?: number): boolean {
    if (gen !== undefined && gen !== this.#gen) return false;
    this.#replay = { meta, number: gameNumber };
    this.cursor = 0;
    return true;
  }

  exitReplay(): void {
    untrack(() => this.#gen++);
    this.#replay = null;
    this.cursor = null;
  }
}

export const [getGameStore, setGameStore] = createContext<GameStore>();
