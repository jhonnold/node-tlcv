export type ViewerSource = { kind: 'live'; port: number } | { kind: 'archive'; slug: string };
export type Route = { name: 'lobby' } | { name: 'viewer'; source: ViewerSource } | { name: 'admin' };

const LIVE = /^\/(\d+)\/?$/;
const ARCHIVE = /^\/archive\/([A-Za-z0-9_]+)\/?$/; // mirrors server SAFE_SLUG
const ADMIN = /^\/admin\/?$/;

export function parsePath(pathname: string): Route | null {
  if (pathname === '/') return { name: 'lobby' };
  const live = LIVE.exec(pathname);
  if (live) return { name: 'viewer', source: { kind: 'live', port: Number(live[1]) } };
  const archive = ARCHIVE.exec(pathname);
  if (archive) return { name: 'viewer', source: { kind: 'archive', slug: archive[1] } };
  if (ADMIN.test(pathname)) return { name: 'admin' };
  return null;
}

export const apiBase = (s: ViewerSource): string =>
  s.kind === 'live' ? `/broadcasts/${s.port}` : `/archives/${s.slug}`;
export const pagePath = (s: ViewerSource): string => (s.kind === 'live' ? `/${s.port}` : `/archive/${s.slug}`);
