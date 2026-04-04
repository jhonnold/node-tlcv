import { RemoteInfo, Socket, createSocket } from 'dgram';
import { udpMessagesReceived, udpMessagesOutOfOrder } from '../metrics.js';
import { logger } from '../util/index.js';

export type MessageCallback = (message: string) => void;

export class UdpTransport {
  private host: string;
  private port: number;
  private lastMessage: number | undefined;
  private socket: Socket;
  private onParsedMessage: MessageCallback;
  private closed: boolean;

  constructor(host: string, port: number, onParsedMessage: MessageCallback) {
    this.host = host;
    this.port = port;
    this.onParsedMessage = onParsedMessage;
    this.closed = false;

    this.socket = createSocket('udp4');

    this.socket.on('error', this.onError.bind(this));
    this.socket.on('listening', this.onListening.bind(this));
    this.socket.on('message', this.onMessage.bind(this));

    this.socket.bind(port);
  }

  private onError(err: Error): void {
    logger.error(`Unexpected socket error - ${err}`, { port: this.port });

    this.closed = true;
    this.socket.close();
  }

  private onListening(): void {
    const address = this.socket.address();
    logger.info(`Listening @ ${address.address}:${address.port}`, { port: this.port });
  }

  private onMessage(msg: Buffer, rInfo: RemoteInfo): void {
    if (this.closed) return;

    logger.debug(`Message received from ${rInfo.address}:${rInfo.port}: ${msg}`, { port: this.port });

    const fullMessage = msg.toString().trim();
    udpMessagesReceived.inc({ port: String(this.port) });

    let messageText: string;

    if (fullMessage.startsWith('<')) {
      const [idString, ...rest] = fullMessage.substring(1).split('>');
      this.send(`ACK: ${idString}`);

      const id = parseInt(idString);
      if (id === 1) {
        logger.info(`Mesasge ids restarting. Going to 1 from ${this.lastMessage}`, { port: this.port });
      } else if (this.lastMessage && id < this.lastMessage) {
        logger.warn(
          `Received an odd ordering of messages! Last: ${this.lastMessage}, Next: ${id}, SKIPPING PROCESSING!`,
          { port: this.port },
        );
        udpMessagesOutOfOrder.inc({ port: String(this.port) });
        return;
      }

      this.lastMessage = id;

      messageText = rest.join('>');
    } else {
      logger.debug(`No message id for ${fullMessage}`, { port: this.port });
      messageText = fullMessage;
    }

    this.onParsedMessage(messageText);
  }

  send(msg: string): void {
    if (this.closed) return;

    logger.debug(`Sending message ${msg} to ${this.host}:${this.port}`, { port: this.port });
    this.socket.send(msg, this.port, this.host);
  }

  close(): void {
    this.closed = true;
    this.socket.close();
  }
}
