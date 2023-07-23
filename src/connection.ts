import { RemoteInfo, Socket, createSocket } from 'dgram';
import { setInterval } from 'timers';
import AsyncLock from 'async-lock';
import { logger } from './util/index.js';
import Handler from './handler.js';

const PROCESSING_INTERVAL = 100;

class Connection {
  private host: string;

  private port: number;

  private lastMessage: number | undefined;

  private socket: Socket;

  private handler: Handler;

  private unproccessed: string[];

  private acks: string[];

  private timer: NodeJS.Timeout;

  private ackTimer: NodeJS.Timeout;

  private lock: AsyncLock;

  constructor(host: string, port: number, handler: Handler) {
    this.host = host;
    this.port = port;
    this.handler = handler;
    this.unproccessed = [];
    this.acks = [];
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

    this.ackTimer = setInterval(() => {
      this.lock.acquire('acks', () => {
        const ids = [...this.acks];
        this.acks = [];
        return ids;
      })
      .then((ids) => {
        if (!ids.length) return;

        ids.forEach(id => this.send(`ACK: ${id}`));
      })
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

    const fullMessage = msg.toString().trim();
    let messageText: string;

    if (fullMessage.startsWith('<')) {
      const [idString, ...rest] = fullMessage.substring(1).split('>');

      this.lock.acquire('acks', () => {
        this.acks.push(idString);
      });

      const id = parseInt(idString);
      if (id === 1) {
        logger.info(`Mesasge ids restarting. Going to 1 from ${this.lastMessage}`, { port: this.port });
      } else if (this.lastMessage && id < this.lastMessage) {
        logger.warn(`Received an odd ordering of messages! Last: ${this.lastMessage}, Next: ${id}, SKIPPING PROCESSING!`, { port: this.port });
        // Hot exit, to avoid pushing this message out of order.
        return;
      }

      this.lastMessage = id;

      messageText = rest.join('>');
    } else {
      logger.debug(`No message id for ${fullMessage}`, { port: this.port });
      messageText = fullMessage;
    }

    this.lock.acquire('messages', () => {
      this.unproccessed.push(messageText);
    });
  }

  send(msg: string): void {
    logger.debug(`Sending message ${msg} to ${this.host}:${this.port}`, { port: this.port });
    this.socket.send(msg, this.port, this.host);
  }

  close(): void {
    clearInterval(this.timer);
    clearInterval(this.ackTimer);
    this.socket.close();
  }
}

export default Connection;
