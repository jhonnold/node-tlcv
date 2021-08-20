import { Server, Socket } from 'socket.io';
import broadcasts, { Broadcast } from './broadcast';
import { logger, uniqueName } from './util';

export const io = new Server();

io.on('connection', (socket: Socket) => {
  let broadcast: Broadcast | undefined;
  let username: string | undefined;

  socket.on('join', ({ port, user }: { port: number; user: string }) => {
    broadcast = broadcasts.get(port);
    if (!broadcast) return;

    broadcast.browserCount++;

    username = uniqueName(user, broadcast.spectators);
    if (username) broadcast.spectators.add(username);

    logger.info(`${username} joined at port ${port}!`);

    socket.join(String(port));
    socket.emit('update', broadcast.toJSON());
  });

  socket.on('chat', (msg: string) => {
    if (broadcast) broadcast.sendChat(msg);
  });

  socket.on('nick', (user: string) => {
    if (!broadcast) return;

    username = uniqueName(user, broadcast.spectators);
    if (username) broadcast.spectators.add(username);

    socket.emit('update', broadcast.toJSON());
  });

  socket.on('disconnect', () => {
    if (!broadcast) return;

    broadcast.browserCount--;

    if (username) broadcast.spectators.delete(username);

    logger.info(`${username} has left from port ${broadcast.port}!`);
  });
});
