// public/js/utils/logos.js

/**
 * Get the URL for the logo of an engine.
 * We make our best attempt to split the name from the version by:
 *   * Splitting the string into words based upon non-alphanumeric characters
 *   * Taking all words before the first word that contains a digit
 *   * Joining the words with underscores
 */
export function getLogoUrl(engine) {
  const words = engine.toLowerCase().split(/[^a-z0-9]+/);
  const versionIdx = words.findIndex((v, i) => i > 0 && /\d/.test(v));
  return `url('/img/logos/${words.slice(0, versionIdx < 0 ? words.length : versionIdx).join('_')}.webp')`;
}
