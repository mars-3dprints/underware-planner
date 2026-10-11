import { isLinear, isVertical, pieceShape } from './pieces';
import { piecePorts, type Port } from './ports';
import type { Cell, Part } from './types';

/** SVG affine matrix [a, b, c, d, e, f]. */
export type Matrix = [number, number, number, number, number, number];

export const matrixAttr = (m: Matrix) => `matrix(${m.join(' ')})`;
export const applyMatrix = (m: Matrix, x: number, y: number): Cell => ({
  x: m[0] * x + m[2] * y + m[4],
  y: m[1] * x + m[3] * y + m[5],
});

/**
 * Outline of a channel in its own frame, plus the matrix (rotation, mirror, position) that places it on the canvas.
 * Straights and bridges have no shape: their outline is their rectangle in world cells and `m` is null.
 */
export function channelGeometry(part: Part): { d: string; m: Matrix | null; sep?: string } {
  const shape = part.sub ? pieceShape(part.sub, Math.max(part.w, part.h)) : undefined;
  const { x, y } = part;
  if (!shape) return { d: `M${x} ${y}H${x + part.w}V${y + part.h}H${x}Z`, m: null };
  const { w, h } = shape;
  const rot = (part.rot ?? 0) % 4;
  let m: Matrix =
    rot === 0
      ? [1, 0, 0, 1, x, y]
      : rot === 1
        ? [0, 1, -1, 0, x + h, y]
        : rot === 2
          ? [-1, 0, 0, -1, x + w, y + h]
          : [0, -1, 1, 0, x, y + w];
  if (part.flip) m = [-m[0], -m[1], m[2], m[3], m[4] + m[0] * w, m[5] + m[1] * w];
  return { d: shape.d, m, sep: shape.sep };
}

/** Openings of a channel: in its own frame with the matrix that places it, or in world cells (m = null). */
export function channelPorts(part: Part): { ports: Port[]; m: Matrix | null } {
  if (isLinear(part.sub)) {
    const { x, y } = part;
    const length = Math.max(part.w, part.h);
    const ports: Port[] = isVertical(part)
      ? [
          [x + 0.5, y, 0, -1],
          [x + 0.5, y + length, 0, 1],
        ]
      : [
          [x, y + 0.5, -1, 0],
          [x + length, y + 0.5, 1, 0],
        ];
    return { ports, m: null };
  }
  const shape = part.sub ? pieceShape(part.sub, Math.max(part.w, part.h)) : undefined;
  return {
    ports: shape && part.sub ? piecePorts(part.sub, shape.w) : [],
    m: shape ? channelGeometry(part).m : null,
  };
}
