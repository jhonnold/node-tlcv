import slugify from 'slugify';

export function siteSlug(site: string): string {
  return slugify(site, '_');
}

export function gameFilenameSlug(gameNumber: number, whiteName: string, blackName: string): string {
  return slugify(`${gameNumber}_${whiteName}_vs_${blackName}`, '_').toLowerCase();
}
