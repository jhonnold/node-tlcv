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
  readonly host: string;
  readonly ip: string;
  readonly port: number;
  readonly spectators: Set<string>;
  readonly chat: string[];
  readonly menu: Map<string, string>;
  readonly game: ChessGame;
  readonly handler: Handler;

  browserCount: number; // managed by io based on active viewer count
  results: string; // handler updates and maintains this based on active broadcast

  private connection: Connection;
  private pings: NodeJS.Timeout;

  constructor(host: string, ip: string, port: number) {
    this.host = host;
    this.ip = ip;
    this.port = port;

    this.game = new ChessGame(String(this.port));
    this.handler = new Handler(this);
    this.connection = new Connection(this.ip, this.port, this.handler);

    this.connection.send(`LOGONv15:${username}`);
    this.pings = setInterval(() => {
      this.connection.send('PING');
    }, 10000);

    this.browserCount = 0;
    this.results = '';
    this.spectators = new Set();
    this.chat = [];
    this.menu = new Map<string, string>();

    this.reloadResults();
  }

  reloadResults() {
    this.connection.send('RESULTTABLE');
  }

  sendChat(msg: string): void {
    this.connection.send(`CHAT: ${msg}`);
  }

  reconnect(): void {
    clearInterval(this.pings);
    this.connection.send('LOGOFF');
    this.connection.close();

    setTimeout(() => {
      this.connection = new Connection(this.ip, this.port, this.handler);
      this.connection.send(`LOGONv15:${username}`);
      this.pings = setInterval(() => {
        this.connection.send('PING');
      }, 10000);
    }, 500);
  }

  close(): void {
    clearInterval(this.pings);
    this.connection.send('LOGOFF');

    setTimeout(() => {
      this.connection.close();
    }, 500);
  }

  toJSON(includeChat = false): SerializedBroadcast {
    const menu: Record<string, string> = Object.fromEntries(this.menu.entries());

    return {
      game: this.game.toJSON(),
      spectators: Array.from(this.spectators),
      browserCount: this.browserCount,
      chat: includeChat ? this.chat.slice(-1000) : [],
      menu,
    };
  }
}

const broadcasts = new Map<number, Broadcast>();

export default broadcasts;
