import Connection from './connection.js';
import GameService from './game-service.js';
import { ChessGame } from './chess-game.js';
import { BroadcastState } from './broadcast-state.js';
import { emitUpdate, emitChat } from './socket-io-adapter.js';
import type { ParsedResults, GameRecord } from './services/result-parser.js';
import type { SerializedBroadcast } from '../shared/types.js';

export type { SerializedBroadcast } from '../shared/types.js';

export const username = 'tlcv.net';
const PING_INTERVAL_MS = 10000;

export class Broadcast {
  readonly host: string;
  readonly ip: string;
  readonly port: number;
  readonly game: ChessGame;
  private state: BroadcastState;
  private gameService: GameService;
  private conn: Connection;
  private pings!: NodeJS.Timeout;

  constructor(host: string, ip: string, port: number) {
    this.host = host;
    this.ip = ip;
    this.port = port;

    this.state = new BroadcastState();
    this.game = new ChessGame(String(this.port));
    this.gameService = new GameService(this);
    this.conn = new Connection(this.ip, this.port, this.processMessages.bind(this));

    this.connect();
    this.reloadResults();
  }

  private connect(): void {
    this.conn.send(`LOGONv15:${username}`);
    this.pings = setInterval(() => this.conn.send('PING'), PING_INTERVAL_MS);
  }

  private async processMessages(messages: string[]): Promise<void> {
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

  reconnect(): void {
    clearInterval(this.pings);
    this.conn.send('LOGOFF');
    this.conn.close();

    setTimeout(() => {
      this.conn = new Connection(this.ip, this.port, this.processMessages.bind(this));
      this.connect();
    }, 500);
  }

  close(): void {
    clearInterval(this.pings);
    this.conn.send('LOGOFF');

    setTimeout(() => this.conn.close(), 500);
  }

  toJSON(includeChat = false): SerializedBroadcast {
    return {
      game: this.game.toJSON(),
      ...this.state.toJSON(includeChat),
    };
  }

  public get connection(): string {
    return `${this.host}:${this.port}`;
  }

  public get results(): string {
    return this.state.results;
  }

  public set results(v: string) {
    this.state.results = v;
  }

  public get spectators(): Set<string> {
    return this.state.spectators;
  }

  public get chat(): Array<string> {
    return this.state.chat;
  }

  public get browserCount(): number {
    return this.state.browserCount;
  }

  public set browserCount(v: number) {
    this.state.browserCount = v;
  }

  public get menu(): Map<string, string> {
    return this.state.menu;
  }

  public get parsedResults(): ParsedResults | null {
    return this.state.parsedResults;
  }

  public set parsedResults(v: ParsedResults | null) {
    this.state.parsedResults = v;
  }

  public get parsedGames(): GameRecord[] | null {
    return this.state.parsedGames;
  }

  public set parsedGames(v: GameRecord[] | null) {
    this.state.parsedGames = v;
  }

  public get currentGameNumber(): number {
    return this.state.currentGameNumber;
  }

  public set currentGameNumber(v: number) {
    this.state.currentGameNumber = v;
  }
}

const broadcasts = new Map<number, Broadcast>();

export default broadcasts;
