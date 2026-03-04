import { logger } from '../util/index.js';

const PROCESSING_INTERVAL = 100;

export type BatchConsumer = (messages: string[]) => Promise<void>;

export class MessageBuffer {
  private buffer: string[];
  private consumer: BatchConsumer;
  private timer: NodeJS.Timeout;
  private processing: boolean;
  private port: number;

  constructor(port: number, consumer: BatchConsumer) {
    this.buffer = [];
    this.consumer = consumer;
    this.processing = false;
    this.port = port;

    this.timer = setInterval(() => this.drain(), PROCESSING_INTERVAL);
  }

  push(message: string): void {
    this.buffer.push(message);
  }

  private async drain(): Promise<void> {
    if (this.processing || !this.buffer.length) return;

    this.processing = true;

    // Swap the buffer so new messages accumulate in a fresh array
    const messages = this.buffer;
    this.buffer = [];

    try {
      logger.debug(`Processing a total of ${messages.length} message(s)`, { port: this.port });
      await this.consumer(messages);
    } catch (err) {
      logger.error(`Error processing messages - ${err}`, { port: this.port });
    } finally {
      this.processing = false;
    }
  }

  close(): void {
    clearInterval(this.timer);
  }
}
