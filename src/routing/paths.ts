import type { Cell } from '../domain/types';

/** Corner radius, in cells, of cable bends outside channels. */
export const BEND_RADIUS = 0.32;

/** Unit direction from `a` to `b` on the grid. */
const dir = (a: Cell, b: Cell): Cell => ({ x: Math.sign(b.x - a.x), y: Math.sign(b.y - a.y) });

/** Radius of the bend at `c` between `p` and `n`: at most half of either leg. */
const bendRadius = (p: Cell, c: Cell, n: Cell) =>
  Math.min(BEND_RADIUS, Math.hypot(c.x - p.x, c.y - p.y) / 2, Math.hypot(n.x - c.x, n.y - c.y) / 2);

/** SVG commands after the first point: straight legs with a rounded corner at every bend. */
export function roundedLegs(points: Cell[]): string {
  let d = '';
  for (let i = 1; i < points.length - 1; i++) {
    const p = points[i - 1];
    const c = points[i];
    const n = points[i + 1];
    const r = bendRadius(p, c, n);
    const u1 = dir(p, c);
    const u2 = dir(c, n);
    d += ` L${c.x - u1.x * r} ${c.y - u1.y * r} Q${c.x} ${c.y} ${c.x + u2.x * r} ${c.y + u2.y * r}`;
  }
  const last = points[points.length - 1];
  return d + ` L${last.x} ${last.y}`;
}

export const cellCenter = (c: Cell): Cell => ({ x: c.x + 0.5, y: c.y + 0.5 });

/** Rounded path through the centres of cells. */
export function cellPath(cells: Cell[]): string {
  const points = cells.map(cellCenter);
  const start = `M${points[0].x} ${points[0].y}`;
  return points.length === 1 ? start : start + roundedLegs(points);
}

/** Where a waypoint handle sits on the drawn cable: bends are rounded, so it goes to the middle of the curve. */
export function waypointHandle(draw: Cell[], waypoint: Cell): Cell {
  const i = draw.findIndex(
    (p, k) => k > 0 && k < draw.length - 1 && p.x === waypoint.x && p.y === waypoint.y,
  );
  if (i < 0) return cellCenter(waypoint);
  const p = draw[i - 1];
  const c = draw[i];
  const n = draw[i + 1];
  const r = bendRadius(p, c, n);
  const u1 = dir(p, c);
  const u2 = dir(c, n);
  return { x: c.x + 0.5 + 0.25 * r * (u2.x - u1.x), y: c.y + 0.5 + 0.25 * r * (u2.y - u1.y) };
}
