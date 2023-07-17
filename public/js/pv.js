export default function pvString(game, color) {
  const { pvMoveNumber: n, pv } = game[color];
  const printOn = color === 'white' ? 0 : 1;

  return pv.reduce(
    (h, move, idx) =>
      `${h}${idx % 2 === printOn ? `<strong>${n + Math.floor((idx + printOn) / 2)}</strong>. ` : ''}${move} `,
    color === 'white' ? '' : `<strong>${n}...</strong> `,
  );
}
