import $ from 'jquery';

// Thanks to Finn Eggers for this file.
// It can be seen in use in originality @
// https://koivisto-chess.com/engine/

function transform(xy, angle, xy0) {
  // put x and y relative to x0 and y0 so we can rotate around that
  const rel_x = xy[0] - xy0[0];
  const rel_y = xy[1] - xy0[1];

  // compute rotated relative points
  const new_rel_x = Math.cos(angle) * rel_x - Math.sin(angle) * rel_y;
  const new_rel_y = Math.sin(angle) * rel_x + Math.cos(angle) * rel_y;

  return [xy0[0] + new_rel_x, xy0[1] + new_rel_y];
}

function drawArrow(context, x0, y0, x1, y1, width, head_width, head_length) {
  // compute length first
  let length = Math.sqrt((x1 - x0) * (x1 - x0) + (y1 - y0) * (y1 - y0));
  let angle = Math.atan2(y1 - y0, x1 - x0);
  // adjust the angle by 90 degrees since the arrow we rotate is rotated by 90 degrees
  angle -= Math.PI / 2;

  let p0 = [x0, y0];

  // order will be: p1 -> p3 -> p5 -> p7 -> p6 -> p4 -> p2
  // formulate the two base points
  let p1 = [x0 + width / 2, y0];
  let p2 = [x0 - width / 2, y0];

  // formulate the upper base points which connect the pointy end with the lengthy thing
  let p3 = [x0 + width / 2, y0 + length - head_length];
  let p4 = [x0 - width / 2, y0 + length - head_length];

  // formulate the outter points of the triangle
  let p5 = [x0 + head_width / 2, y0 + length - head_length];
  let p6 = [x0 - head_width / 2, y0 + length - head_length];

  // end point of the arrow
  let p7 = [x0, y0 + length];

  p1 = transform(p1, angle, p0);
  p2 = transform(p2, angle, p0);
  p3 = transform(p3, angle, p0);
  p4 = transform(p4, angle, p0);
  p5 = transform(p5, angle, p0);
  p6 = transform(p6, angle, p0);
  p7 = transform(p7, angle, p0);

  // move to start first
  context.moveTo(p1[0], p1[1]);
  context.beginPath();
  // start drawing the lines
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

export function drawMove(move, theme) {
  const board = $('#board');
  const breite = board.height();

  const canvas = $('#arrow-board')[0];
  const ctx = canvas.getContext('2d');

  if (ctx === null) return;

  const fromX = move.charCodeAt(0) - 96;
  const fromY = Number(move.charAt(1));
  const toX = move.charCodeAt(2) - 96;
  const toY = Number(move.charAt(3));

  // compute width, center of the board and arrow start and end points
  const b = breite / 8;
  const c = b / 2;
  const sx = fromX * b - c;
  const sy = 2400 - (fromY * b - c);
  const ex = toX * b - c;
  const ey = 2400 - (toY * b - c);
  const w = (b / 3.5) * 0.5;

  ctx.fillStyle = theme == 'light' ? `rgba(25, 118, 210, 0.9)` : `rgba(105, 179, 126, 0.9)`;
  drawArrow(ctx, sx, sy, ex, ey, w, 3.5 * w, b / 3);
}

export function clearArrows() {
  const canvas = $('#arrow-board')[0];
  const ctx = canvas.getContext('2d');

  if (ctx === null) return;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
}
