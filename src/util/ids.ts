import crypto from 'node:crypto';

// Short, collision-resistant ids for runtime-managed configs (kibitzers, webhooks).
export function genId(): string {
  return crypto.randomUUID().slice(0, 8);
}
