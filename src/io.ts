import { Server, Socket } from 'socket.io';
import broadcasts, { Broadcast } from './broadcast';
import { logger } from './util';

export const io = new Server();

io.on('connection', (socket: Socket) => {
  let broadcast: Broadcast | null = null;
  let username: string | null = null;

  socket.on('join', ({ port, user }: { port: number; user: string }) => {
    broadcast = broadcasts[port];
    if (!broadcast) return;

    if (broadcast.spectators.has(user)) {
      let i = 1,
        newUsername = user;
      do {
        newUsername = user + String(i++);
      } while (broadcast.spectators.has(newUsername));

      username = newUsername;
    } else {
      username = user;
    }

    if (username) broadcast.spectators.add(username);
    broadcast.browserCount++;
    logger.info(`${username} joined at port ${port}!`);

    socket.join(String(port));
    socket.emit('update', broadcast.toJSON());
  });

  socket.on('chat', (msg: string) => {
    if (broadcast) broadcast.sendChat(msg);
  });

  socket.on('nick', (user: string) => {
    if (!broadcast) return;

    if (username)
      broadcast.spectators.delete(username);

    if (broadcast.spectators.has(user)) {
      let i = 1,
        newUsername = user;
      do {
        newUsername = user + String(i++);
      } while (broadcast.spectators.has(newUsername));

      username = newUsername;
    } else {
      username = user;
    }

    if (username)
      broadcast.spectators.add(username);

    socket.emit('update', broadcast.toJSON());
  });

  socket.on('disconnect', () => {
    if (broadcast) {
      broadcast.browserCount--;

      if (username) broadcast.spectators.delete(username);
    }

    logger.info(`${username} has left from port ${broadcast ? broadcast.port : 0}!`);
  });
});
