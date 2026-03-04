import { UdpTransport } from './transport/udp-transport.js';
import { MessageBuffer, BatchConsumer } from './transport/message-buffer.js';

class Connection {
  private transport: UdpTransport;

  private messageBuffer: MessageBuffer;

  constructor(host: string, port: number, onBatch: BatchConsumer) {
    this.messageBuffer = new MessageBuffer(port, onBatch);
    this.transport = new UdpTransport(host, port, (msg) => this.messageBuffer.push(msg));
  }

  send(msg: string): void {
    this.transport.send(msg);
  }

  close(): void {
    this.messageBuffer.close();
    this.transport.close();
  }
}

export default Connection;
