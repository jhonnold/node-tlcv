// public/js/components/board/arrows.js
import $ from '../../$/index.js';

function transform(xy, angle, xy0) {
  const relX = xy[0] - xy0[0];
  const relY = xy[1] - xy0[1];
  const newRelX = Math.cos(angle) * relX - Math.sin(angle) * relY;
  const newRelY = Math.sin(angle) * relX + Math.cos(angle) * relY;
  return [xy0[0] + newRelX, xy0[1] + newRelY];
}

function drawArrow(context, x0, y0, x1, y1, width, headWidth, headLength) {
  const length = Math.sqrt((x1 - x0) * (x1 - x0) + (y1 - y0) * (y1 - y0));
  let angle = Math.atan2(y1 - y0, x1 - x0);
  angle -= Math.PI / 2;

  const p0 = [x0, y0];
  let p1 = [x0 + width / 2, y0];
  let p2 = [x0 - width / 2, y0];
  let p3 = [x0 + width / 2, y0 + length - headLength];
  let p4 = [x0 - width / 2, y0 + length - headLength];
  let p5 = [x0 + headWidth / 2, y0 + length - headLength];
  let p6 = [x0 - headWidth / 2, y0 + length - headLength];
  let p7 = [x0, y0 + length];

  p1 = transform(p1, angle, p0);
  p2 = transform(p2, angle, p0);
  p3 = transform(p3, angle, p0);
  p4 = transform(p4, angle, p0);
  p5 = transform(p5, angle, p0);
  p6 = transform(p6, angle, p0);
  p7 = transform(p7, angle, p0);

  context.moveTo(p1[0], p1[1]);
  context.beginPath();
  context.lineTo(p3[0], p3[1]);
  context.lineTo(p5[0], p5[1]);
  context.lineTo(p7[0], p7[1]);
  context.lineTo(p6[0], p6[1]);
  context.lineTo(p4[0], p4[1]);
  context.lineTo(p2[0], p2[1]);
  context.lineTo(p1[0], p1[1]);
  context.closePath();
  context.arc(x0, y0, width / 2, angle - Math.PI, angle);
  context.fill();
}

export function drawMove(move, color, shift = 0) {
  const board = $('#board');
  const breite = board.height();

  const canvas = $('#arrow-board')[0];
  const ctx = canvas.getContext('2d');

  if (ctx === null) return;

  const fromX = move.charCodeAt(0) - 96;
  const fromY = Number(move.charAt(1));
  const toX = move.charCodeAt(2) - 96;
  const toY = Number(move.charAt(3));

  const maxY = $('#arrow-board').height();

  const b = breite / 8;
  const c = b / 2;
  const sx = fromX * b - c;
  const sy = maxY - (fromY * b - c);
  const ex = toX * b - c;
  const ey = maxY - (toY * b - c);
  const w = (b / 3.5) * 0.5;
  const l = Math.sqrt((ex - sx) ** 2 + (ey - sy) ** 2);
  const offset = transform([((ex - sx) * shift * w) / 4 / l, ((ey - sy) * shift * w) / 4 / l], 3.1415926 / 2, [0, 0]);

  ctx.fillStyle = color;
  drawArrow(ctx, sx + offset[0], sy + offset[1], ex + offset[0], ey + offset[1], w, 3.5 * w, b / 3);
}

export function clearArrows() {
  const canvas = $('#arrow-board')[0];
  const ctx = canvas.getContext('2d');
  if (ctx === null) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

export default { drawMove, clearArrows };
