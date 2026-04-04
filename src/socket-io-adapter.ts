import { Server, Socket } from 'socket.io';
import broadcasts, { Broadcast } from './broadcast.js';
import { logger, uniqueName } from './util/index.js';
import { spectatorJoins, spectatorLeaves, socketEmissions } from './metrics.js';
import { EmitType } from '../shared/types.js';
import type { BroadcastDelta } from '../shared/types.js';

export { EmitType } from '../shared/types.js';

const io = new Server({
  perMessageDeflate: {
    threshold: 256,
  },
});

io.on('connection', (socket: Socket) => {
  let broadcast: Broadcast | undefined;
  let username: string | undefined;

  socket.on('join', ({ port, user }: { port: number; user: string }) => {
    broadcast = broadcasts.get(port);
    if (!broadcast) return;

    broadcast.browserCount++;
    spectatorJoins.inc({ port: String(port), event: broadcast.game.site ?? 'unknown' });

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

    socket.emit('state', broadcast.toJSON());
  });

  socket.on('disconnect', () => {
    if (!broadcast) return;

    broadcast.browserCount--;
    spectatorLeaves.inc({ port: String(broadcast.port), event: broadcast.game.site ?? 'unknown' });

    if (username) broadcast.spectators.delete(username);

    logger.info(`${username} has left from port ${broadcast.port}!`, { port: broadcast.port });
  });
});

export function emitUpdate(port: number, data: BroadcastDelta): void {
  socketEmissions.inc({ port: String(port), event: broadcasts.get(port)?.game.site ?? 'unknown', type: 'update' });
  io.to(String(port)).emit(EmitType.UPDATE, data);
}

export function emitChat(port: number, messages: string[]): void {
  socketEmissions.inc({ port: String(port), event: broadcasts.get(port)?.game.site ?? 'unknown', type: 'chat' });
  io.to(String(port)).emit(EmitType.CHAT, messages);
}

export { io };
