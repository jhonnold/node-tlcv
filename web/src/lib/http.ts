export class HttpError extends Error {
  readonly status: number;
  constructor(status: number, url: string) {
    super(`HTTP ${status} for ${url}`);
    this.name = 'HttpError';
    this.status = status;
  }
}

async function request(url: string, init: RequestInit = {}): Promise<Response> {
  const res = await fetch(url, { credentials: 'same-origin', ...init });
  if (!res.ok) throw new HttpError(res.status, url);
  return res;
}

export async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const res = await request(url, { headers: { Accept: 'application/json' }, signal });
  // Unknown paths hit the server catch-all redirect to `/` and come back as the HTML shell.
  if (!res.headers.get('content-type')?.includes('application/json')) throw new HttpError(404, url);
  return (await res.json()) as T;
}

export async function getText(url: string): Promise<string> {
  return (await request(url)).text();
}

export async function postJson(url: string, body: unknown): Promise<void> {
  await request(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function del(url: string): Promise<void> {
  await request(url, { method: 'DELETE' });
}
