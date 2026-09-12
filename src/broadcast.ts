import Connection from './connection.js';
import GameService from './game-service.js';
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

/** Why a LOGON was re-sent — a metrics label, so keep the values stable. */
export type ReloginReason = 'watchdog' | 'server-notice';

// Messages that arrive whether or not the broadcast is actually alive: PONG is a
// keepalive TLCS keeps answering after logging us out, MSG is how it announces
// that logout, and LOGON/FEATURE/level are handshake replies our own re-login
// provokes. Letting any of them touch the liveness clock would mask the outage
// that clock exists to expose — a re-login that is acknowledged but restores no
// data would look like recovery. Real game traffic (FEN, WPLAYER, SITE, moves,
// times, PVs) accompanies every genuine game start, so nothing is lost by
// ignoring the handshake.
const NON_DATA_PREFIXES = ['PONG', 'MSG', 'LOGON', 'FEATURE', 'level'];
const isBroadcastData = (msg: string): boolean => !NON_DATA_PREFIXES.some((cmd) => msg.startsWith(cmd));

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
  readonly game: ChessGame;
  readonly kibitzerManager: KibitzerManager | null;

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
  // Two distinct clocks: `lastDataAt` is the outage signal and must keep climbing
  // through failed re-logins; `lastReloginAt` only rate-limits our own retries.
  private lastDataAt = Date.now();
  private lastReloginAt = 0;

  constructor(host: string, ip: string, port: number, kibitzerManager?: KibitzerManager, ephemeral = false) {
    this.host = host;
    this.ip = ip;
    this.port = port;
    this.ephemeral = ephemeral;

    this.kibitzerManager = kibitzerManager ?? null;
    this.game = new ChessGame(String(this.port));
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
      // the data channel goes quiet. That's what we watch.
      if (Date.now() - this.lastDataAt > env.dataTimeoutMs) this.relogin('watchdog');
    }, PING_INTERVAL_MS);
  }

  private login(): void {
    // A fresh session restarts TLCS's message ids, so the old high-water mark has
    // to go with it or the new stream is rejected as out-of-order. `onMessage`
    // only special-cases a restart at exactly 1; any other value would strand the
    // broadcast permanently. Safe to clear here because we only get this far after
    // the old session is known dead — either minutes of silence or an explicit
    // logout notice — so there is nothing left in flight to replay over it.
    this.conn.resetMessageIds();
    this.conn.send(`LOGONv15:${username}`);
  }

  /**
   * Re-establishes the TLCS session after it was dropped.
   *
   * Deliberately leaves `lastDataAt` alone. That clock backs
   * `ccrl_broadcast_seconds_since_data`, the signal production alarms on, so it
   * has to keep climbing across re-logins that don't fix anything — resetting it
   * here would make a permanently dead broadcast sawtooth below any threshold at
   * or above the timeout and never alert. Rate limiting rides its own timestamp.
   */
  relogin(reason: ReloginReason): void {
    const now = Date.now();
    if (now - this.lastReloginAt < RELOGIN_MIN_INTERVAL_MS) return;
    this.lastReloginAt = now;

    logger.warn(`Re-sending LOGON (${reason}); ${Math.round(this.secondsSinceData)}s since last broadcast data`, {
      port: this.port,
    });

    this.login();
    reloginAttempts.inc({ port: String(this.port), reason });
  }

  private async processMessages(messages: string[]): Promise<void> {
    if (messages.some(isBroadcastData)) this.lastDataAt = Date.now();

    const { update, chat } = await this.gameService.onMessages(messages);

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
    clearInterval(this.pings);
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
      site: this.game.site,
      port: this.port,
      updated: new Date().toISOString(),
      results: this.results,
      parsedResults: this.parsedResults,
      parsedGames: this.parsedGames ?? [],
    };
  }

  get connection(): string {
    return `${this.host}:${this.port}`;
  }

  /** How long this broadcast has gone without real data — see `ccrl_broadcast_seconds_since_data`. */
  get secondsSinceData(): number {
    return (Date.now() - this.lastDataAt) / 1000;
  }

  /** Metrics/display label for the tournament, falling back before an event is announced. */
  get eventLabel(): string {
    return this.game.site || 'unknown';
  }
}

const broadcasts = new Map<number, Broadcast>();

export default broadcasts;
