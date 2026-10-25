import type { Request, Response } from 'express';

// The Svelte SPA shell (built by Vite into build/public). Page routes run their server-side
// guards (redirects, basic auth) first, then hand the same shell to the client router.
export function sendApp(_: Request, res: Response): void {
  res.sendFile('index.html', { root: 'build/public' });
}
