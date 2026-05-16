export type WebhookEventKind = 'game-started' | 'game-finished';

export type DiscordWebhookConfig = {
  id: string; // 8-char uuid prefix, auto-assigned
  type: 'discord';
  name?: string; // human label for the admin table
  url: string; // Discord webhook URL (secret)
  ports?: number[]; // empty/unset => all broadcasts
  events?: WebhookEventKind[]; // empty/unset => both events
};

// Discriminated union by `type` — only Discord today, ready to grow.
export type WebhookConfig = DiscordWebhookConfig;

// Normalized payload passed to senders — senders never touch ChessGame.
export type GameStartedEvent = {
  kind: 'game-started';
  port: number;
  gameNumber: number;
  white: string;
  black: string;
  site: string;
};

export type GameFinishedEvent = {
  kind: 'game-finished';
  port: number;
  gameNumber: number;
  white: string;
  black: string;
  site: string;
  result: string;
  opening: string;
};

export type WebhookEvent = GameStartedEvent | GameFinishedEvent;

export interface WebhookSender {
  // Fire-and-forget; implementations must never throw and always resolve,
  // even on HTTP/network failure (logged internally).
  send(event: WebhookEvent, url: string): Promise<void>;
  type(): string;
}
