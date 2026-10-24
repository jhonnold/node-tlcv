export class HttpError extends Error {
  readonly status: number;
  constructor(status: number, url: string) {
    super(`HTTP ${status} for ${url}`);
    this.name = 'HttpError';
    this.status = status;
  }
}

async function request(url: string, init: RequestInit = {}): Promise<Response> {
  const method = init.method ?? 'GET';
  // Unknown paths hit the server catch-all, which redirects to `/`. Non-GET requests are not
  // followed (manual), so the redirect surfaces as an opaqueredirect and is reported as a 404.
  const res = await fetch(url, {
    credentials: 'same-origin',
    redirect: method === 'GET' ? 'follow' : 'manual',
    ...init,
  });
  if (res.type === 'opaqueredirect' || res.redirected) throw new HttpError(404, url);
  if (!res.ok) throw new HttpError(res.status, url);
  return res;
}

export async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const res = await request(url, { headers: { Accept: 'application/json' }, signal });
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
