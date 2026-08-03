import slugify from 'slugify';

// Broadcasters announce SITE as a path into their own share, with a file extension
// attached. Strip both so everything derived from the site — the slug, the archive
// folder, the homepage label — is stable per tournament rather than per broadcaster.
const SITE_PREFIXES = ['GrahamCCRL.dyndns.org\\'];

export function normalizeSite(raw: string): string {
  let site = raw;
  for (const prefix of SITE_PREFIXES) site = site.replace(prefix, '');

  return site.replace(/\.[\w]+$/, '');
}

export function siteSlug(site: string): string {
  return slugify(site, '_');
}

export function gameFilenameSlug(gameNumber: number, whiteName: string, blackName: string): string {
  return slugify(`${gameNumber}_${whiteName}_vs_${blackName}`, '_').toLowerCase();
}
