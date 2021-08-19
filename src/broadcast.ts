import Connection from './connection';
import Handler from './handler';
import { ChessGame } from './chess-game';

export const defaultUrl = '125.237.41.141';
export const defaultPort = 16093;
export const username = 'tlcv.net';

export class Broadcast {
  private _url: string;
  private _port: number;
  private _results: string;
  private _browserCount: number;
  private _spectators: Set<string>;
  private _chat: string[];
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

  close(): void {
    clearInterval(this._pings);
    this._connection.send('LOGOFF');
    setTimeout(this._connection.close, 250);
  }

  toJSON(): any {
    return {
      ...this._game.toJSON(),
      spectators: Array.from(this._spectators),
      browserCount: this._browserCount,
      chat: this._chat.slice(-100),
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

  public get chat(): string[] {
    return this._chat;
  }

  public get browserCount(): number {
    return this._browserCount;
  }

  public set browserCount(v: number) {
    this._browserCount = v;
  }
}

const broadcasts: { [name: number]: Broadcast } = {
  16001: new Broadcast('125.237.41.141', 16001),
  16002: new Broadcast('125.237.41.141', 16002),
  16053: new Broadcast('125.237.41.141', 16053),
  16063: new Broadcast('125.237.41.141', 16063),
  16064: new Broadcast('125.237.41.141', 16064),
  16065: new Broadcast('125.237.41.141', 16065),
  16091: new Broadcast('125.237.41.141', 16091),
  16092: new Broadcast('125.237.41.141', 16092),
  16093: new Broadcast('125.237.41.141', 16093),
  16083: new Broadcast('125.237.41.141', 16083),
  16084: new Broadcast('125.237.41.141', 16084),
};

export default broadcasts;
