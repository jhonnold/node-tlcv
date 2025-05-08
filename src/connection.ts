import { RemoteInfo, Socket, createSocket } from 'dgram';
import { logger } from './util/index';
import Handler from './handler';

class Connection {
  private host: string;
  private port: number;

  private lastMessage: number | undefined;

  private socket: Socket;
  private handler: Handler;

  private processing: boolean = false;
  private queue: string[] = [];

  constructor(host: string, port: number, handler: Handler) {
    this.host = host;
    this.port = port;
    this.handler = handler;

    this.socket = createSocket('udp4');
    this.socket.on('error', (err) => this.onError(err));
    this.socket.on('listening', () => this.onListening());
    this.socket.on('message', (buf, remote) => this.onMessage(buf, remote));
    this.socket.bind(port);
  }

  private onError(err: Error) {
    logger.error(`Unexpected socket error - ${err}`, { port: this.port });

    this.socket.close();
  }

  private onListening() {
    const address = this.socket.address();
    logger.info(`Listening @ ${address.address}:${address.port}`, { port: this.port });
  }

  private async onMessage(msg: Buffer, rInfo: RemoteInfo) {
    logger.debug(`Message received from ${rInfo.address}:${rInfo.port}: ${msg}`, { port: this.port });

    const trimmedMessage = msg.toString().trim();
    const idMatch = /^<\s*(\d+)\s*>(.+)$/.exec(trimmedMessage);

    if (idMatch) {
      this.send(`ACK: ${idMatch[1]}`);

      const id = parseInt(idMatch[1]);
      if (!isNaN(id)) {
        if (id === 1) {
          logger.info(`Mesasge ids restarting. Going to 1 from ${this.lastMessage}`, { port: this.port });
        } else if (this.lastMessage && id < this.lastMessage) {
          logger.warn(
            `Received an odd ordering of messages! Last: ${this.lastMessage}, Next: ${id}, SKIPPING PROCESSING!`,
            { port: this.port },
          );

          // Hot exit, as we've received a message out of order
          // and don't want to process it.
          return;
        }

        this.lastMessage = id;
      } else {
        logger.warn(`Received an unparsable message id: ${idMatch[1]}!`, { port: this.port });
      }

      this.queue.push(idMatch[2].trim());
    } else {
      this.queue.push(trimmedMessage);
    }

    await this.processQueue();
  }

  private async processQueue() {
    if (this.processing) return;
    this.processing = true;

    while (this.queue.length > 0) {
      await this.handler.onMessage(this.queue.shift());
    }

    this.processing = false;
  }

  send(msg: string) {
    logger.debug(`Sending message ${msg} to ${this.host}:${this.port}`, { port: this.port });
    this.socket.send(msg, this.port, this.host);
  }

  close() {
    this.socket.close();
  }
}

export default Connection;
