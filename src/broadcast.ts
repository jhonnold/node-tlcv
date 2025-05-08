import Connection from './connection';
import Handler from './handler';
import { ChessGame, SerializedGame } from './chess-game';

export const username = 'ccrl.live';

export interface SerializedBroadcast {
  game: SerializedGame;
  spectators: string[];
  browserCount: number;
  chat: string[];
  menu: Record<string, string>;
}

export class Broadcast {
  private _host: string;

  private _ip: string;

  private _port: number;

  private _results: string;

  private _browserCount: number;

  private _spectators: Set<string>;

  private _chat: string[];

  private _menu: Map<string, string>;

  private _game: ChessGame;

  private _handler: Handler;

  private _connection: Connection;

  private _pings: NodeJS.Timeout;

  constructor(host: string, ip: string, port: number) {
    this._host = host;
    this._ip = ip;
    this._port = port;

    this._game = new ChessGame(String(this._port));
    this._handler = new Handler(this);
    this._connection = new Connection(this._ip, this._port, this._handler);

    this._connection.send(`LOGONv15:${username}`);
    this._pings = setInterval(() => {
      this._connection.send('PING');
    }, 10000);

    this._browserCount = 0;
    this._results = '';
    this._spectators = new Set();
    this._chat = [];
    this._menu = new Map<string, string>();

    this.reloadResults();
  }

  reloadResults() {
    this._connection.send('RESULTTABLE');
  }

  sendChat(msg: string): void {
    this._connection.send(`CHAT: ${msg}`);
  }

  reconnect(): void {
    clearInterval(this._pings);
    this._connection.send('LOGOFF');
    this._connection.close();

    setTimeout(() => {
      this._connection = new Connection(this._ip, this._port, this._handler);
      this._connection.send(`LOGONv15:${username}`);
      this._pings = setInterval(() => {
        this._connection.send('PING');
      }, 10000);
    }, 500);
  }

  close(): void {
    clearInterval(this._pings);
    this._connection.send('LOGOFF');

    setTimeout(() => {
      this._connection.close();
    }, 500);
  }

  toJSON(includeChat = false): SerializedBroadcast {
    const menu: Record<string, string> = {};
    for (const e of this._menu.entries()) menu[e[0]] = e[1];

    return {
      game: this.game.toJSON(),
      spectators: Array.from(this._spectators),
      browserCount: this._browserCount,
      chat: includeChat ? this._chat.slice(-1000) : [],
      menu,
    };
  }

  public get host(): string {
    return this._host;
  }

  public get ip(): string {
    return this._ip;
  }

  public get port(): number {
    return this._port;
  }

  public get connection(): string {
    return `${this._host}:${this._port}`;
  }

  public get results(): string {
    return this._results;
  }

  public set results(v: string) {
    this._results = v;
  }

  public get game(): ChessGame {
    return this._game;
  }

  public get spectators(): Set<string> {
    return this._spectators;
  }

  public get chat(): string[] {
    return this._chat;
  }

  public get browserCount(): number {
    return this._browserCount;
  }

  public set browserCount(v: number) {
    this._browserCount = v;
  }

  public get menu(): Map<string, string> {
    return this._menu;
  }
}

const broadcasts = new Map<number, Broadcast>();

export default broadcasts;
