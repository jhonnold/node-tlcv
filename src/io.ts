import { Server, Socket } from 'socket.io';
import broadcasts, { Broadcast } from './broadcast';
import { logger } from './util';

export const io = new Server();

io.on('connection', (socket: Socket) => {
  let broadcast: Broadcast | null = null;

  socket.on('join', (port: number) => {
    broadcast = broadcasts[port];
    if (!broadcast) return;

    broadcast.browserCount++;
    logger.info(`A user joined at port ${port}!`);

    socket.join(String(port));
    socket.emit('update', broadcast.toJSON());
  });

  socket.on('chat', (msg: string) => {
    if (broadcast) broadcast.sendChat(msg);
  });

  socket.on('disconnect', () => {
    if (broadcast) broadcast.browserCount--;

    logger.info('A user has left!');
  });
});
