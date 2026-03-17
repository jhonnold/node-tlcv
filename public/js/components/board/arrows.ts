// public/js/components/board/arrows.js
import $ from 'jquery';

const CHAR_CODE_A = 96; // 'a'.charCodeAt(0) - 1, so file 'a' = 1

function rotatePoint(point: number[], angle: number, origin: number[]) {
  const dx = point[0] - origin[0];
  const dy = point[1] - origin[1];
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return [origin[0] + cos * dx - sin * dy, origin[1] + sin * dx + cos * dy];
}

function drawArrow(
  ctx: CanvasRenderingContext2D,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  shaftWidth: number,
  headWidth: number,
  headLength: number,
) {
  const length = Math.sqrt((endX - startX) ** 2 + (endY - startY) ** 2);
  const angle = Math.atan2(endY - startY, endX - startX) - Math.PI / 2;

  const origin = [startX, startY];
  const halfShaft = shaftWidth / 2;
  const shaftEnd = length - headLength;

  // Arrow shape points (before rotation): shaft right/left, head-base right/left, tip
  const shaftTopRight = rotatePoint([startX + halfShaft, startY], angle, origin);
  const shaftTopLeft = rotatePoint([startX - halfShaft, startY], angle, origin);
  const shaftBottomRight = rotatePoint([startX + halfShaft, startY + shaftEnd], angle, origin);
  const shaftBottomLeft = rotatePoint([startX - halfShaft, startY + shaftEnd], angle, origin);
  const headRight = rotatePoint([startX + headWidth / 2, startY + shaftEnd], angle, origin);
  const headLeft = rotatePoint([startX - headWidth / 2, startY + shaftEnd], angle, origin);
  const tip = rotatePoint([startX, startY + length], angle, origin);

  ctx.moveTo(shaftTopRight[0], shaftTopRight[1]);
  ctx.beginPath();
  ctx.lineTo(shaftBottomRight[0], shaftBottomRight[1]);
  ctx.lineTo(headRight[0], headRight[1]);
  ctx.lineTo(tip[0], tip[1]);
  ctx.lineTo(headLeft[0], headLeft[1]);
  ctx.lineTo(shaftBottomLeft[0], shaftBottomLeft[1]);
  ctx.lineTo(shaftTopLeft[0], shaftTopLeft[1]);
  ctx.lineTo(shaftTopRight[0], shaftTopRight[1]);
  ctx.closePath();
  ctx.arc(startX, startY, halfShaft, angle - Math.PI, angle);
  ctx.fill();
}

export function drawMove(move: string, color: string, flipped = false) {
  const board = $('#board');
  const boardSize = board.height()!;

  const canvas = $('#arrow-board')[0] as HTMLCanvasElement;
  const ctx = canvas.getContext('2d');

  if (ctx === null) return;

  let fromFile = move.charCodeAt(0) - CHAR_CODE_A;
  let fromRank = Number(move.charAt(1));
  let toFile = move.charCodeAt(2) - CHAR_CODE_A;
  let toRank = Number(move.charAt(3));

  if (flipped) {
    fromFile = 9 - fromFile;
    fromRank = 9 - fromRank;
    toFile = 9 - toFile;
    toRank = 9 - toRank;
  }

  const canvasHeight = $('#arrow-board').height()!;

  const squareSize = boardSize / 8;
  const squareCenter = squareSize / 2;
  const startX = fromFile * squareSize - squareCenter;
  const startY = canvasHeight - (fromRank * squareSize - squareCenter);
  const endX = toFile * squareSize - squareCenter;
  const endY = canvasHeight - (toRank * squareSize - squareCenter);
  const arrowWidth = (squareSize / 3.5) * 0.5;

  ctx.fillStyle = color;
  drawArrow(ctx, startX, startY, endX, endY, arrowWidth, 3.5 * arrowWidth, squareSize / 3);
}

export function clearArrows() {
  const canvas = $('#arrow-board')[0] as HTMLCanvasElement;
  const ctx = canvas.getContext('2d');
  if (ctx === null) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}
