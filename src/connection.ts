import { RemoteInfo, Socket, createSocket } from 'dgram';
import { logger } from './util';
import Handler from './handler';
import { setInterval } from 'timers';
import AsyncLock from 'async-lock';

class Connection {
  private host: string;
  private port: number;
  private socket: Socket;
  private handler: Handler;
  private unproccessed: string[];
  private timer: NodeJS.Timeout;
  private lock: AsyncLock;

  constructor(host: string, port: number, handler: Handler) {
    this.host = host;
    this.port = port;
    this.handler = handler;
    this.unproccessed = [];
    this.lock = new AsyncLock();

    this.socket = createSocket('udp4');

    this.socket.on('error', this.onError.bind(this));
    this.socket.on('listening', this.onListening.bind(this));
    this.socket.on('message', this.onMessage.bind(this));

    this.socket.bind(port);

    this.timer = setInterval(() => {
      this.lock
        .acquire('messages', () => {
          const messages = [...this.unproccessed];
          this.unproccessed = [];
          return messages;
        })
        .then((messages) => {
          if (!messages.length) return;

          this.lock
            .acquire('processing', () => this.handler.onMessages(messages))
            .then((ids) => ids.forEach((id) => this.send(`ACK: ${id}`)));
        });
    }, 10);
  }

  private onError(err: Error): void {
    logger.error(err);

    this.socket.close();
  }

  private onListening(): void {
    const address = this.socket.address();
    logger.info(`Listening @ ${address.address}:${address.port}`);
  }

  private onMessage(msg: Buffer, rInfo: RemoteInfo): void {
    logger.debug(`Message received from ${rInfo.address}:${rInfo.port}: ${msg}`);

    this.lock.acquire('messages', () => {
      this.unproccessed.push(msg.toString().trim());
    });
  }

  send(msg: string): void {
    logger.debug(`Sending message ${msg} to ${this.host}:${this.port}`);
    this.socket.send(msg, this.port, this.host);
  }

  close(): void {
    clearInterval(this.timer);
    this.socket.close();
  }
}

export default Connection;
