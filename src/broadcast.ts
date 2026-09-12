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

/** Why a LOGON was re-sent — a metrics label, so keep the values stable. */
export type ReloginReason = 'watchdog' | 'server-notice';

// PONG is a keepalive TLCS keeps answering after it has logged us out, and MSG is
// how it announces that logout. Neither is evidence of a live session, so neither
// may refresh the data-liveness clock the watchdog reads.
const KEEPALIVE_ONLY = ['PONG', 'MSG'];
const isBroadcastData = (msg: string): boolean => !KEEPALIVE_ONLY.some((cmd) => msg.startsWith(cmd));

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
  private lastDataAt = Date.now();

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
    // to go with it or the new stream is rejected as out-of-order.
    this.conn.resetMessageIds();
    this.conn.send(`LOGONv15:${username}`);
  }

  /**
   * Re-establishes the TLCS session after it was dropped. Bumping `lastDataAt` is
   * also the backoff: the watchdog can't fire again until another full timeout of
   * silence has passed, so a genuinely unreachable server sees one LOGON per
   * window rather than one per ping.
   */
  relogin(reason: ReloginReason): void {
    logger.warn(`Re-sending LOGON (${reason}); ${Math.round(this.secondsSinceData)}s since last broadcast data`, {
      port: this.port,
    });

    this.lastDataAt = Date.now();
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
