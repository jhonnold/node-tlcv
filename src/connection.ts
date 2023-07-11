import { RemoteInfo, Socket, createSocket } from 'dgram';
import { logger } from './util/index.js';
import Handler from './handler.js';
import { setInterval } from 'timers';
import AsyncLock from 'async-lock';

const PROCESSING_INTERVAL = 100;

class Connection {
  private host: string;
  private port: number;
  private lastMessage: number | undefined;
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
        .acquire(
          'processing',
          async () => {
            const messages = await this.lock.acquire(
              'messages',
              () => {
                const messages = [...this.unproccessed];
                this.unproccessed = [];
                return messages;
              },
              { skipQueue: true },
            );

            if (!messages.length) return;

            logger.debug(`Processing a total of ${messages.length} message(s)`, { port: this.port });
            await this.handler.onMessages(messages);
          },
          { timeout: PROCESSING_INTERVAL },
        )
        .catch((err: Error) => {
          if (!err.message.startsWith('async-lock timed out'))
            logger.error(`Error processing messages - ${err}`, { port: this.port });
        });
    }, PROCESSING_INTERVAL);
  }

  private onError(err: Error): void {
    logger.error(`Unexpected socket error - ${err}`, { port: this.port });

    this.socket.close();
  }

  private onListening(): void {
    const address = this.socket.address();
    logger.info(`Listening @ ${address.address}:${address.port}`, { port: this.port });
  }

  private onMessage(msg: Buffer, rInfo: RemoteInfo): void {
    logger.debug(`Message received from ${rInfo.address}:${rInfo.port}: ${msg}`, { port: this.port });

    let message = msg.toString().trim();
    const idMatch = /^<\s*(\d+)>/g.exec(message);

    if (idMatch) {
      this.send(`ACK: ${idMatch[1]}`);

      const id = parseInt(idMatch[1]);
      if (this.lastMessage && id < this.lastMessage)
        logger.warn(`Received an odd ordering of messages! Last: ${this.lastMessage}, Next: ${id}`, {
          port: this.port,
        });

      this.lastMessage = id;

      message = message.replace(/^<\s*(\d+)>/g, '');
    } else {
      logger.debug(`No message id found for ${message}`, { port: this.port });
    }

    this.lock.acquire('messages', () => {
      this.unproccessed.push(message);
    });
  }

  send(msg: string): void {
    logger.debug(`Sending message ${msg} to ${this.host}:${this.port}`, { port: this.port });
    this.socket.send(msg, this.port, this.host);
  }

  close(): void {
    clearInterval(this.timer);
    this.socket.close();
  }
}

export default Connection;
