import { RemoteInfo, Socket, createSocket } from 'dgram';
import { logger } from './util';
import Handler from './handler';

class Connection {
  private host: string;
  private port: number;
  private socket: Socket;
  private handler: Handler;

  constructor(host: string, port: number, handler: Handler) {
    this.host = host;
    this.port = port;
    this.handler = handler;

    this.socket = createSocket('udp4');

    this.socket.on('error', this.onError.bind(this));
    this.socket.on('listening', this.onListening.bind(this));
    this.socket.on('message', this.onMessage.bind(this));

    this.socket.bind(port);
  }

  private onError(err: Error) {
    logger.error(err);
    this.socket.close();
  }

  private onListening() {
    const address = this.socket.address();
    logger.info(`Listening @ ${address.address}:${address.port}`);
  }

  private onMessage(msg: Buffer, rInfo: RemoteInfo) {
    logger.debug(`Message received from ${rInfo.address}:${rInfo.port}`);
    logger.info(msg);

    const id = this.handler.onMessage(msg);

    if (id)
      this.send(`ACK: ${id}`);
  }

  send(msg: string): void {
    logger.debug(`Sending message ${msg} to ${this.host}:${this.port}`);
    this.socket.send(msg, this.port, this.host);
  }

  close(): void {
    this.socket.close();
  }
}

export default Connection;
