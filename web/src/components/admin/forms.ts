import { DASH } from '$lib/format';
import { del, HttpError, postJson } from '$lib/http';
import type { KibitzerStatus, WebhookStatus } from '$shared/types';

/** Runs one mutation, then refetches every list. Resolves to success. */
export type Mutate = (label: string, action: () => Promise<void>) => Promise<boolean>;

/** Adds an entry, or replaces entry `id`: the API has no PUT, so an edit is delete-then-add. */
export const saveEntry = (mutate: Mutate, base: string, noun: string, id: string | null, body: unknown) =>
  mutate(id ? `Saving the ${noun}` : `Adding the ${noun}`, async () => {
    if (id) await del(`${base}/${encodeURIComponent(id)}`);
    await postJson(base, body);
  });
export const removeEntry = (mutate: Mutate, base: string, noun: string, id: string) =>
  mutate(`Removing the ${noun}`, () => del(`${base}/${encodeURIComponent(id)}`));

export function describeError(label: string, e: unknown): string {
  if (!(e instanceof HttpError)) return `${label} failed: network error.`;
  if (e.status === 400) return `${label} failed: the server rejected it (HTTP 400). Check the server log.`;
  if (e.status === 401) return `${label} failed: not signed in (HTTP 401). Reload the page to sign in.`;
  if (e.status === 503) return `${label} failed: the admin panel is disabled (HTTP 503, TLCV_PASSWORD unset).`;
  return `${label} failed (HTTP ${e.status}).`;
}

export type KibitzerForm = {
  type: 'local' | 'ssh';
  enginePath: string;
  priority: number | null;
  threads: number | null;
  hash: number | null;
  host: string;
  port: number | null;
  username: string;
  privateKeyPath: string;
};
export const blankKibitzer = (): KibitzerForm => ({
  type: 'local',
  enginePath: '',
  priority: 1,
  threads: 1,
  hash: 256,
  host: '',
  port: 22,
  username: '',
  privateKeyPath: '',
});
export const kibitzerFromStatus = (k: KibitzerStatus): KibitzerForm => ({
  type: k.type === 'ssh' ? 'ssh' : 'local',
  enginePath: k.enginePath ?? '',
  priority: k.priority,
  threads: k.threads,
  hash: k.hash,
  host: k.host ?? '',
  port: k.port ?? 22,
  username: k.username ?? '',
  privateKeyPath: k.privateKeyPath ?? '',
});
export function kibitzerBody(f: KibitzerForm): Record<string, unknown> {
  const body: Record<string, unknown> = { type: f.type, priority: f.priority, threads: f.threads, hash: f.hash };
  const enginePath = f.enginePath.trim();
  if (enginePath) body.enginePath = enginePath;
  if (f.type === 'ssh') {
    body.host = f.host.trim();
    if (f.port && f.port !== 22) body.port = f.port;
    body.username = f.username.trim();
    body.privateKeyPath = f.privateKeyPath.trim();
  }
  return body;
}

export type WebhookForm = {
  type: 'discord';
  name: string;
  url: string;
  ports: string;
  started: boolean;
  finished: boolean;
};
export const blankWebhook = (): WebhookForm => ({
  type: 'discord',
  name: '',
  url: '',
  ports: '',
  started: true,
  finished: true,
});
export const webhookFromStatus = (w: WebhookStatus): WebhookForm => ({
  type: 'discord',
  name: w.name,
  url: w.url,
  ports: w.ports.join(', '),
  started: w.events.includes('game-started'),
  finished: w.events.includes('game-finished'),
});
export function webhookBody(f: WebhookForm): Record<string, unknown> {
  const events: string[] = [];
  if (f.started) events.push('game-started');
  if (f.finished) events.push('game-finished');
  return { type: f.type, name: f.name.trim(), url: f.url.trim(), ports: f.ports.trim(), events };
}

export const maskUrl = (url: string): string => `••••${url.slice(-8)}`;
export const typeLabel = (t: string): string => (t === 'discord' ? 'Discord' : t);
export const targetLabel = (k: KibitzerStatus): string =>
  k.targetPort == null ? DASH : k.targetName ? `${k.targetName} (${k.targetPort})` : `Port ${k.targetPort}`;
