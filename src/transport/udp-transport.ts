import { RemoteInfo, Socket, createSocket } from 'dgram';
import { udpMessagesReceived, udpMessagesOutOfOrder } from '../metrics.js';
import { logger } from '../util/index.js';

export type MessageCallback = (message: string) => void;

// A counter restart lands at the bottom of the id range *and* far below the
// high-water mark. Reordering, and retransmits after a lost ACK, land just below the
// mark — which, early in any session, is itself inside the bottom of the range — so
// the size of the step back has to be checked too, not just where it lands.
const ID_RESTART_WINDOW = 100;

function isIdRestart(id: number, lastMessage: number): boolean {
  if (id >= lastMessage) return false;

  // Exactly 1 is the counter's first value, so it is followed even after a short session.
  return id === 1 || (id <= ID_RESTART_WINDOW && lastMessage - id > ID_RESTART_WINDOW);
}

export class UdpTransport {
  private host: string;
  private port: number;
  private lastMessage: number | undefined;
  private socket: Socket;
  private onParsedMessage: MessageCallback;
  private closed: boolean;

  constructor(host: string, port: number, onParsedMessage: MessageCallback, ephemeral = false) {
    this.host = host;
    this.port = port;
    this.onParsedMessage = onParsedMessage;
    this.closed = false;

    this.socket = createSocket('udp4');

    this.socket.on('error', this.onError.bind(this));
    this.socket.on('listening', this.onListening.bind(this));
    this.socket.on('message', this.onMessage.bind(this));

    if (ephemeral) {
      // Ephemeral mode (opt-in, e.g. for uci-to-tlcs): bind an OS-assigned local
      // port. The server replies to our source port instead of the broadcast
      // port, so we can receive without binding the broadcast port. This lets
      // multiple instances on one host watch the same broadcast (no EADDRINUSE).
      this.socket.bind();
    } else {
      // Classic TLCS: the local socket MUST bind the broadcast port. The server
      // streams the broadcast to clientIP:<broadcast port> and ignores the source
      // port of our LOGON entirely (verified empirically). Binding any other port
      // receives nothing, and two instances on one host cannot share a broadcast.
      this.socket.bind(port);
    }
  }

  private onError(err: Error): void {
    logger.error(`Unexpected socket error - ${err}`, { port: this.port });

    this.closed = true;
    this.socket.close();
  }

  private onListening(): void {
    const address = this.socket.address();
    logger.info(`Listening @ ${address.address}:${address.port} (broadcast ${this.host}:${this.port})`, {
      port: this.port,
    });
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
      if (this.lastMessage && id <= this.lastMessage) {
        // Two very different things look alike here. A jump back to the low end of
        // the range is TLCS restarting its counter for a fresh session — ours after
        // a re-login, or its own after a restart — and the new stream has to be
        // followed or the broadcast stays dark forever. A small step backwards (or a
        // repeat of the last id) is UDP reordering or a retransmit, and replaying it
        // would corrupt game state.
        if (!isIdRestart(id, this.lastMessage)) {
          logger.warn(
            `Received an odd ordering of messages! Last: ${this.lastMessage}, Next: ${id}, SKIPPING PROCESSING!`,
            { port: this.port },
          );
          udpMessagesOutOfOrder.inc({ port: String(this.port) });
          return;
        }

        logger.info(`Message ids restarting. Going to ${id} from ${this.lastMessage}`, { port: this.port });
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
