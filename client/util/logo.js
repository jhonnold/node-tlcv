// Get the url for the logo of an engine.
// We make our best attempt to split the name from the version by:
//   * Splitting the string into words based upon non-alphanumeric characters
//   * Taking all words before the first word that contains a digit
//   * Joining the words with underscores
export function getLogoUrl(engine) {
  const words = engine.toLowerCase().split(/[^a-z0-9]+/);
  const name = [];

  for (const word of words) {
    if (name.length > 0 && /\d/.test(word)) {
      break;
    }

    name.push(word);
  }

  return `url('img/logos/${name.join('_')}.webp`;
}
