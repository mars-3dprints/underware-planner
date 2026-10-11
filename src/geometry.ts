import type { Obj } from './types';
import { arrowsD, isVert, pieceOf, portsOf } from './types';
import type { Port } from './types';

export type Mat = [number, number, number, number, number, number];
/** Outline of a channel in the shape's own cell units, plus the matrix (rotation, mirror, position) that places it on the canvas. */
export function racewayGeom(o: Obj): { d: string; m: Mat | null; sep?: string } {
  const p = o.sub ? pieceOf(o.sub, Math.max(o.w, o.h)) : undefined;
  if (!p) return { d: `M${o.x} ${o.y}H${o.x + o.w}V${o.y + o.h}H${o.x}Z`, m: null };
  const r = (o.rot ?? 0) % 4,
    { w: pw, h: ph } = p,
    x = o.x,
    y = o.y;
  let m: Mat =
    r === 0
      ? [1, 0, 0, 1, x, y]
      : r === 1
        ? [0, 1, -1, 0, x + ph, y]
        : r === 2
          ? [-1, 0, 0, -1, x + pw, y + ph]
          : [0, -1, 1, 0, x, y + pw];
  if (o.flip) m = [-m[0], -m[1], m[2], m[3], m[4] + m[0] * pw, m[5] + m[1] * pw];
  return { d: p.d, m, sep: p.sep };
}
export const matStr = (m: Mat) => `matrix(${m.join(' ')})`;

/** Opening arrows: path data in the shape's own frame (shaped pieces, use with matrix m) or in world cells (m = null). */
export function portsList(o: Obj): { ports: Port[]; m: Mat | null } {
  if (o.sub === 'straight' || o.sub === 'bridge') {
    const l = Math.max(o.w, o.h);
    return {
      ports: isVert(o)
        ? [
            [o.x + 0.5, o.y, 0, -1],
            [o.x + 0.5, o.y + l, 0, 1],
          ]
        : [
            [o.x, o.y + 0.5, -1, 0],
            [o.x + l, o.y + 0.5, 1, 0],
          ],
      m: null,
    };
  }
  const p = o.sub ? pieceOf(o.sub, Math.max(o.w, o.h)) : undefined;
  return { ports: p && o.sub ? portsOf(o.sub, p.w) : [], m: p ? racewayGeom(o).m : null };
}
export function portsPath(o: Obj): { d: string; m: Mat | null } {
  const { ports, m } = portsList(o);
  return { d: arrowsD(ports), m };
}
