import Connection from './connection';
import Handler from './handler';
import ChessGame from './chess-game';

export const game = new ChessGame('16093');
const handler = new Handler(game);
const connection = new Connection('125.237.41.141', 16093, handler);

connection.send('LOGONv15: Node TLCV');
const pings = setInterval(() => connection.send('PING'), 10000);

process.on('SIGINT', () => {
  clearInterval(pings);
  connection.send('LOGOFF');
  setTimeout(connection.close, 500);
});
