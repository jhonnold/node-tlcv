import { Server, Socket } from 'socket.io';
import broadcasts, { Broadcast } from './broadcast';
import { logger, uniqueName } from './util/index';

const io = new Server();

io.on('connection', (socket: Socket) => {
  let broadcast: Broadcast | undefined;
  let username: string | undefined;

  socket.on('join', ({ port, user }: { port: number; user: string }) => {
    broadcast = broadcasts.get(port);
    if (!broadcast) return;

    broadcast.browserCount += 1;

    username = uniqueName(user, broadcast.spectators);
    if (username) broadcast.spectators.add(username);

    logger.info(`${username} joined at port ${port}!`, { port: broadcast.port });

    socket.join(String(port));
    socket.emit('state', broadcast.toJSON(true));
  });

  socket.on('chat', (msg: string) => {
    if (broadcast) broadcast.sendChat(msg);
  });

  socket.on('nick', (user: string) => {
    if (!broadcast) return;

    const originalUsername = username;

    if (username) broadcast.spectators.delete(username);
    username = uniqueName(user, broadcast.spectators);
    if (username) broadcast.spectators.add(username);

    logger.info(`${originalUsername} changed their name to ${username}!`, { port: broadcast.port });

    socket.emit('update', broadcast.toJSON());
  });

  socket.on('disconnect', () => {
    if (!broadcast) return;

    broadcast.browserCount -= 1;

    if (username) broadcast.spectators.delete(username);

    logger.info(`${username} has left from port ${broadcast.port}!`, { port: broadcast.port });
  });
});

export default io;
