import Connection from './connection';
import Handler from './handler';
import { ChessGame, SerializedGame } from './chess-game';

export const defaultUrl = '125.237.41.141';
export const defaultPort = 16001;
export const username = 'tlcv.net';

export type SerializedBroadcast = {
  game: SerializedGame;
  spectators: Array<string>;
  browserCount: number;
  chat: Array<string>;
  menu: { [key: string]: string };
};

export class Broadcast {
  private _url: string;
  private _port: number;
  private _results: string;
  private _browserCount: number;
  private _spectators: Set<string>;
  private _chat: Array<string>;
  private _menu: Map<string, string>;
  private _game: ChessGame;
  private _handler: Handler;
  private _connection: Connection;
  private _pings: NodeJS.Timeout;

  constructor(url = defaultUrl, port = defaultPort) {
    this._url = url;
    this._port = port;

    this._game = new ChessGame(String(this._port));
    this._handler = new Handler(this);
    this._connection = new Connection(this._url, this._port, this._handler);

    this._connection.send(`LOGONv15:${username}`);
    this._pings = setInterval(() => this._connection.send('PING'), 10000);

    this._browserCount = 0;
    this._results = '';
    this._spectators = new Set();
    this._chat = [];
    this._menu = new Map<string, string>();
  }

  loadResults(): Promise<string> {
    return new Promise((resolve) => {
      this._connection.send('RESULTTABLE');

      setTimeout(() => resolve(this._results), 5000);
    });
  }

  sendChat(msg: string): void {
    this._connection.send(`CHAT: ${msg}`);
  }

  reconnect(): void {
    clearInterval(this._pings);
    this._connection.send('LOGOFF');
    this._connection.close();

    setTimeout(() => {
      this._connection = new Connection(this._url, this._port, this._handler);
      this._connection.send(`LOGONv15:${username}`);
      this._pings = setInterval(() => this._connection.send('PING'), 10000);
    }, 500);
  }

  close(): void {
    clearInterval(this._pings);
    this._connection.send('LOGOFF');

    setTimeout(() => this._connection.close(), 500);
  }

  toJSON(): SerializedBroadcast {
    const menu: { [key: string]: string } = {};
    for (const e of this._menu.entries()) menu[e[0]] = e[1];

    return {
      game: this.game.toJSON(),
      spectators: Array.from(this._spectators),
      browserCount: this._browserCount,
      chat: this._chat.slice(-100),
      menu,
    };
  }

  public get port(): number {
    return this._port;
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

  public get chat(): Array<string> {
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
broadcasts.set(16001, new Broadcast(defaultUrl, 16001));
broadcasts.set(16002, new Broadcast(defaultUrl, 16002));
broadcasts.set(16053, new Broadcast(defaultUrl, 16053));
broadcasts.set(16063, new Broadcast(defaultUrl, 16063));
broadcasts.set(16065, new Broadcast(defaultUrl, 16065));
broadcasts.set(16066, new Broadcast(defaultUrl, 16066));
broadcasts.set(16083, new Broadcast(defaultUrl, 16083));
broadcasts.set(16084, new Broadcast(defaultUrl, 16084));
broadcasts.set(16091, new Broadcast(defaultUrl, 16091));
broadcasts.set(16092, new Broadcast(defaultUrl, 16092));
broadcasts.set(16093, new Broadcast(defaultUrl, 16093));

export default broadcasts;
