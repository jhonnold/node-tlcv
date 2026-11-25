import Connection from './connection.js';
import GameService from './game-service.js';
import BoardService from './board-service.js';
import { ChessGame } from './chess-game.js';
import { emitUpdate, emitChat } from './socket-io-adapter.js';
import { logger } from './util/index.js';
import { env } from './config/env.js';
import { reloginAttempts } from './metrics.js';
import type { ParsedResults, GameRecord } from './services/result-parser.js';
import type { SerializedBroadcast, StoredTournamentResults } from '../shared/types.js';
import type { KibitzerManager } from './kibitzer/kibitzer-manager.js';

export type { SerializedBroadcast } from '../shared/types.js';

export const username = 'tlcv.net';
const PING_INTERVAL_MS = 10000;

// Floor on how often a broadcast may re-send LOGON, applied to both triggers:
// without it the watchdog retries on every ping once the timeout is exceeded, and
// a server that repeats the logout notice gets a LOGON back for each one.
const RELOGIN_MIN_INTERVAL_MS = 60000;

// TLCS-MG opt-in (spec §3): `MULTIGAME: 1` follows every LOGON SUCCESSFUL and is resent on each
// tick; without a reply by the last tick (15 s after the LOGON) the server is single-game.
const MULTIGAME_RETRY_MS = 5000;
const MULTIGAME_TRIES = 3;

/**
 * TLCS-MG negotiation. `pending` (after every LOGON, the server forgets the opt-in) and
 * `single` read bare game lines as board 1, like classic TLCS; `mg` reads only `BOARD <id>` lines.
 */
export type MultigameMode = 'pending' | 'mg' | 'single';

/** Why a LOGON was re-sent — a metrics label, so keep the values stable. */
export type ReloginReason = 'watchdog' | 'server-notice';

// Chat retention: how much scrollback is kept in memory, and how much of it a newly
// joining browser is seeded with. Both halves of the policy live here, next to the
// private buffer and the one method allowed to append to it.
const CHAT_LIMIT = 2000;
const CHAT_EMIT_LIMIT = 1000;

export class Broadcast {
  readonly host: string;
  readonly ip: string;
  readonly port: number;
  readonly ephemeral: boolean;
  readonly kibitzerManager: KibitzerManager | null;
  // One per game the server broadcasts, keyed by board number. Board 1 always exists
  // (classic TLCS only ever has it).
  readonly boards = new Map<number, BoardService>();

  // Tournament name from the broadcast-level SITE line; every ChessGame reads it from here.
  site = '';
  // Private so pushChat() is the only way in — that's what bounds the buffer.
  private readonly chat: Array<string> = [];
  readonly spectators = new Set<string>();
  readonly menu = new Map<string, string>();
  results = '';
  parsedResults: ParsedResults | null = null;
  parsedGames: GameRecord[] | null = null;
  currentGameNumber = 1;
  browserCount = 0;

  private gameService: GameService;
  private conn: Connection;
  private pings!: NodeJS.Timeout;
  // Two clocks, deliberately. `lastDataAt` backs `ccrl_broadcast_seconds_since_data`,
  // the signal production alarms on, so it has to keep climbing across re-logins that
  // fix nothing — reset it and a permanently dead broadcast just sawtooths below the
  // threshold and never alerts. `lastReloginAt` carries the rate limit instead. Both
  // read the monotonic clock: a wall-clock step (NTP) would otherwise fake an outage
  // or hold the rate limit shut for the size of the step.
  private lastDataAt = performance.now();
  private lastReloginAt = -Infinity;
  private closed = false;
  private mode: MultigameMode = 'pending';
  private multigameTimer: NodeJS.Timeout | null = null;
  private multigameTicks = 0;

  constructor(host: string, ip: string, port: number, kibitzerManager?: KibitzerManager, ephemeral = false) {
    this.host = host;
    this.ip = ip;
    this.port = port;
    this.ephemeral = ephemeral;

    this.kibitzerManager = kibitzerManager ?? null;
    this.boards.set(1, new BoardService(this, 1));
    this.gameService = new GameService(this);
    this.conn = new Connection(this.ip, this.port, this.processMessages.bind(this), this.ephemeral);

    this.connect();
    this.reloadResults();
  }

  private connect(): void {
    this.login();

    this.pings = setInterval(() => {
      this.conn.send('PING');

      // A dead session still answers PING, so socket silence never happens — only
      // the data channel goes quiet. That's what we watch. Measured from the later of
      // the last data and the last attempt, so a broadcast that stays quiet (a paused
      // tournament) is retried once per timeout, not once per RELOGIN_MIN_INTERVAL_MS.
      const quietSince = Math.max(this.lastDataAt, this.lastReloginAt);
      if (performance.now() - quietSince > env.dataTimeoutMs) this.relogin('watchdog');
    }, PING_INTERVAL_MS);
  }

  private login(): void {
    this.mode = 'pending';
    this.armMultigameRetry();
    this.conn.send(`LOGONv15:${username}`);
  }

  private armMultigameRetry(): void {
    this.stopMultigameRetry();
    this.multigameTicks = 0;
    this.multigameTimer = setInterval(() => this.onMultigameRetry(), MULTIGAME_RETRY_MS);
  }

  private stopMultigameRetry(): void {
    if (this.multigameTimer) clearInterval(this.multigameTimer);
    this.multigameTimer = null;
  }

  /** A tick without a `MULTIGAME:` reply: resend (also covers a lost LOGON SUCCESSFUL), or give up. */
  private onMultigameRetry(): void {
    if (this.closed || this.mode !== 'pending') {
      this.stopMultigameRetry();
      return;
    }

    if (++this.multigameTicks < MULTIGAME_TRIES) {
      this.requestMultigame();
      return;
    }

    this.stopMultigameRetry();
    this.mode = 'single';
    logger.info('No MULTIGAME reply, treating the server as single-game', { port: this.port });
  }

  private requestMultigame(): void {
    this.conn.send('MULTIGAME: 1');
  }

  /** `LOGON SUCCESSFUL`: opt in to TLCS-MG (forgotten by the server on every LOGON) and refresh the crosstable. */
  onLogonSuccessful(): void {
    this.requestMultigame();
    this.reloadResults();
  }

  /**
   * The server's `MULTIGAME:` reply. Entering `mg` discards every board's game — it was built
   * from bare lines — and the server follows its reply with a wrapped snapshot of each board in progress.
   */
  onMultigameReply(version: string): void {
    if (version !== '1') {
      logger.warn(`Ignoring MULTIGAME reply with unknown version ${version}`, { port: this.port });
      return;
    }
    // The answer to a resend after success.
    if (this.mode === 'mg') return;

    this.stopMultigameRetry();
    this.mode = 'mg';
    for (const board of this.boards.values()) board.reset();
    logger.info('Server speaks TLCS-MG v1, following its boards', { port: this.port });
  }

  /** The board with this id, created if new (a TLCS-MG `BOARDS:` list, or an unlisted `BOARD <id>` line). */
  ensureBoard(id: number): BoardService {
    let board = this.boards.get(id);
    if (!board) {
      board = new BoardService(this, id);
      this.boards.set(id, board);
      logger.info(`Added board ${id} (game ${board.game.name})`, { port: this.port });
    }
    return board;
  }

  /** Re-establishes the TLCS session. Rate-limited, and never touches `lastDataAt`. */
  relogin(reason: ReloginReason): void {
    // close() has sent LOGOFF; a notice drained after it must not log us back in.
    if (this.closed) return;

    // The floor only guards against hammering a session that hasn't come back. Once
    // data has flowed since the last attempt, that attempt worked, and a fresh logout
    // notice is a new outage to act on now rather than after the watchdog timeout.
    const now = performance.now();
    const recoveredSinceLastAttempt = this.lastDataAt > this.lastReloginAt;
    if (!recoveredSinceLastAttempt && now - this.lastReloginAt < RELOGIN_MIN_INTERVAL_MS) return;
    this.lastReloginAt = now;

    logger.warn(`Re-sending LOGON (${reason}); ${Math.round(this.secondsSinceData)}s since last broadcast data`, {
      port: this.port,
    });

    this.login();
    reloginAttempts.inc({ port: String(this.port), reason });
  }

  private async processMessages(messages: string[]): Promise<void> {
    // Stamped before processing: a logout notice in this same batch re-logs-in
    // mid-batch, and the data that preceded it must not read as arriving after that
    // attempt (which would lift the rate limit for the notice's duplicates).
    const receivedAt = performance.now();
    const { update, chat, sawLiveData } = await this.gameService.onMessages(messages);
    if (sawLiveData) this.lastDataAt = receivedAt;

    if (update) emitUpdate(this.port, update);
    if (chat.length) emitChat(this.port, chat);
  }

  reloadResults() {
    this.conn.send('RESULTTABLE');
  }

  sendChat(msg: string): void {
    this.conn.send(`CHAT: ${msg}`);
  }

  /** Appends to the chat scrollback, trimming the oldest entries past CHAT_LIMIT. */
  pushChat(message: string): void {
    if (this.chat.length >= CHAT_LIMIT) this.chat.splice(0, this.chat.length - (CHAT_LIMIT - 1));
    this.chat.push(message);
  }

  close(): void {
    this.closed = true;
    clearInterval(this.pings);
    this.stopMultigameRetry();
    this.conn.send('LOGOFF');

    setTimeout(() => this.conn.close(), 500);
  }

  toJSON(): SerializedBroadcast {
    return {
      game: this.game.toJSON(this.kibitzerManager?.getLiveData(this.port) ?? null),
      spectators: Array.from(this.spectators),
      chat: this.chat.slice(-CHAT_EMIT_LIMIT),
      menu: Object.fromEntries(this.menu),
    };
  }

  /** The persisted shape of this tournament's standings + schedule. */
  toStoredResults(): StoredTournamentResults {
    return {
      site: this.site,
      port: this.port,
      updated: new Date().toISOString(),
      results: this.results,
      parsedResults: this.parsedResults,
      parsedGames: this.parsedGames ?? [],
    };
  }

  /** Board 1's game, the only one in classic TLCS. */
  get game(): ChessGame {
    return this.boards.get(1)!.game;
  }

  get multigameMode(): MultigameMode {
    return this.mode;
  }

  get connection(): string {
    return `${this.host}:${this.port}`;
  }

  /** How long this broadcast has gone without real data — see `ccrl_broadcast_seconds_since_data`. */
  get secondsSinceData(): number {
    return (performance.now() - this.lastDataAt) / 1000;
  }

  /** Metrics/display label for the tournament, falling back before an event is announced. */
  get eventLabel(): string {
    return this.site || 'unknown';
  }
}

const broadcasts = new Map<number, Broadcast>();

export default broadcasts;
