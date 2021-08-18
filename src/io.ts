import { Server, Socket } from 'socket.io';
import broadcasts from './broadcast';
import { logger } from './util';

export const io = new Server();

io.on('connection', (socket: Socket) => {
  socket.on('join', (port: number) => {
    logger.info(`A user joined at port ${port}!`);

    socket.join(String(port));
    socket.emit('update', broadcasts[port].game.toJSON());
  });

  socket.on('disconnect', () => {
    logger.info('A user has left!');
  });
});
