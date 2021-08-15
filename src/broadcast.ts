import Connection from './connection';
import Handler from './handler';
import ChessGame from './chess-game';

export class Broadcast {
  public url: string;
  public port: number;
  public game: ChessGame;
  public handler: Handler;
  public connection: Connection;
  public results: string;

  private pings: NodeJS.Timeout;

  constructor(url = '125.237.41.141', port = 16093) {
    this.url = url;
    this.port = port;

    this.game = new ChessGame(String(this.port));
    this.handler = new Handler(this.game);
    this.connection = new Connection(this.url, this.port, this.handler);

    this.connection.send('LOGONv15:Node TLCV');
    this.pings = setInterval(() => this.connection.send('PING'), 10000);

    this.handler.broadcast = this;
    this.results = '';
  }

  close(): void {
    clearInterval(this.pings);
    this.connection.send('LOGOFF');
    setTimeout(this.connection.close, 250);
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
