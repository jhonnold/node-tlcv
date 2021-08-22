export function pv(game, color) {
  const { moveNumber } = game;

  const printOn = color == 'white' ? 0 : 1;
  const html = game[color].pv.reduce((h, move, idx) => {
    if (idx % 2 == printOn) h += `<strong>${moveNumber + Math.floor(idx / 2) + 1}</strong>. `;

    return h + `${move} `;
  }, '');

  return color == 'white' ? html : `<strong>${moveNumber}...</strong> ` + html;
}
