export function getPort(): number {
  return +window.location.pathname.replace(/\//g, '');
}

// Archive (previous broadcast) pages live at `/archive/<slug>`. Detecting the mode
// and the API base from the pathname keeps the data layer self-contained — no
// server-injected globals needed.
export function isArchive(): boolean {
  return window.location.pathname.startsWith('/archive/');
}

export function archiveSlug(): string {
  return decodeURIComponent(window.location.pathname.split('/')[2] ?? '');
}

export function apiBase(): string {
  return isArchive() ? `/archive/${archiveSlug()}` : `/${getPort()}`;
}
