export function pv(game, color) {
  const { pvMoveNumber: n, pv } = game[color];
  const printOn = color == 'white' ? 0 : 1;

  return pv.reduce((h, move, idx) => {
    if (idx % 2 == printOn) h += `<strong>${n + Math.floor((idx + printOn) / 2)}</strong>. `;

    return h + `${move} `;
  }, color == 'white' ? '' : `<strong>${n}...</strong> `);
}
