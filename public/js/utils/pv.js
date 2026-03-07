export function formatPv(pv, pvMoveNumber, color) {
  if (!pv || !pv.length) return '';

  const printOn = color === 'white' ? 0 : 1;

  return pv.reduce(
    (h, move, idx) =>
      `${h}${
        idx % 2 === printOn ? `<strong>${pvMoveNumber + Math.floor((idx + printOn) / 2)}</strong>. ` : ''
      }${move} `,
    color === 'white' ? '' : `<strong>${pvMoveNumber}...</strong> `,
  );
}

export default function pvString(game, color) {
  const { pvMoveNumber: n, pv } = game[color];
  return formatPv(pv, n, color);
}
