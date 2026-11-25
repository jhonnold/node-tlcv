import { Server, Socket } from 'socket.io';
import broadcasts, { Broadcast } from './broadcast.js';
import type BoardService from './board-service.js';
import { logger, uniqueName } from './util/index.js';
import { spectatorJoins, spectatorLeaves, socketEmissions } from './metrics.js';
import { EmitType } from '../shared/types.js';
import type { BroadcastDelta, GameDelta } from '../shared/types.js';

export { EmitType } from '../shared/types.js';

const io = new Server({
  perMessageDeflate: {
    threshold: 256,
  },
});

// A socket joins two rooms: `<port>` for what every viewer of the broadcast shares (chat,
// spectators, menu, the board list) and `<port>:<board>` for that board's game deltas.
function boardRoom(port: number, board: number): string {
  return `${port}:${board}`;
}

io.on('connection', (socket: Socket) => {
  let broadcast: Broadcast | undefined;
  let board: BoardService | undefined;
  let username: string | undefined;

  socket.on('join', ({ port, user, board: requested }: { port: number; user: string; board?: number }) => {
    // One join per socket (boards change via `switch-board` on the same socket); a second would count it twice.
    if (broadcast) return;

    broadcast = broadcasts.get(port);
    if (!broadcast) return;

    // No board (a tab from before boards) or one that doesn't exist gets board 1; `state.board`
    // says which. Only existing boards: a client never creates one.
    board = broadcast.boards.get(requested ?? 1) ?? broadcast.boards.get(1)!;
    board.browserCount++;
    spectatorJoins.inc({ port: String(port) });

    username = uniqueName(user, broadcast.spectators);
    if (username) broadcast.spectators.add(username);

    logger.info(`${username} joined board ${board.id} at port ${port}!`, { port: broadcast.port });

    socket.join([String(port), boardRoom(port, board.id)]);
    socket.emit('state', broadcast.toJSON(board.id));
    emitSpectators(broadcast);
  });

  socket.on('switch-board', (requested: number) => {
    if (!broadcast || !board) return;

    const next = broadcast.boards.get(requested) ?? broadcast.boards.get(1)!;
    // A re-pick of the selected board is a no-op; a fallback to the current board still answers, so the client
    // corrects `#board`.
    if (next === board && next.id === requested) return;

    if (next !== board) {
      socket.leave(boardRoom(broadcast.port, board.id));
      board.browserCount--;
      next.browserCount++;
      board = next;
      socket.join(boardRoom(broadcast.port, next.id));

      logger.info(`${username} switched to board ${next.id} at port ${broadcast.port}!`, { port: broadcast.port });
    }

    socket.emit('state', broadcast.toJSON(next.id));
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

    // A rename only changes the spectator list; emitSpectators pushes that to
    // the whole room (including this socket). Emitting full state here would
    // re-seed chat history from an empty payload and wipe the user's chat box.
    emitSpectators(broadcast);
  });

  socket.on('disconnect', () => {
    if (!broadcast || !board) return;

    board.browserCount--;
    spectatorLeaves.inc({ port: String(broadcast.port) });

    if (username) broadcast.spectators.delete(username);

    logger.info(`${username} has left from port ${broadcast.port}!`, { port: broadcast.port });
    emitSpectators(broadcast);
  });
});

/** Broadcast-level changes (spectators, menu, boards), to every viewer of the port. */
export function emitUpdate(port: number, data: BroadcastDelta): void {
  socketEmissions.inc({ port: String(port), type: 'update' });
  io.to(String(port)).emit(EmitType.UPDATE, data);
}

/** One board's game delta, to the viewers of that board. */
export function emitGameUpdate(port: number, board: number, game: GameDelta): void {
  socketEmissions.inc({ port: String(port), type: 'update' });
  const delta: BroadcastDelta = { board, game };
  io.to(boardRoom(port, board)).emit(EmitType.UPDATE, delta);
}

// Broadcast the current spectator list to everyone in the room. Used after
// browser-driven changes (join/nick/disconnect) so already-connected clients
// see viewers come and go without refreshing.
function emitSpectators(broadcast: Broadcast): void {
  emitUpdate(broadcast.port, { spectators: Array.from(broadcast.spectators) });
}

export function emitChat(port: number, messages: string[]): void {
  socketEmissions.inc({ port: String(port), type: 'chat' });
  io.to(String(port)).emit(EmitType.CHAT, messages);
}

export { io };
