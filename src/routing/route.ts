import { anchorCell, partsById, sameCell } from '../domain/anchors';
import { CELL_MM } from '../domain/constants';
import type { Bounds, Cell, Doc, Part } from '../domain/types';
import { cablePath, shapedChannels } from './follow';
import { MinHeap } from './minHeap';
import { cellPath } from './paths';

export interface Route {
  /** Cells of each leg between consecutive points. */
  segs: Cell[][];
  /** Start, waypoints and end. */
  pts: Cell[];
  /** Corners of the cell path (bends only). */
  draw: Cell[];
  /** SVG path following channel shapes, or '' when the cable crosses none (draw `draw` instead). */
  d: string;
  steps: number;
  bends: number;
  mm: number;
}

const DIRECTIONS: Cell[] = [
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
  { x: 0, y: -1 },
];
/** Extra cost per bend, so routes prefer straight runs. */
const BEND_COST = 1.2;
/** Search state = cell index * STATES + direction of arrival (4 = start). */
const STATES = 5;
const START = 4;

/** Horizontal then vertical: the fallback when there is no way around. */
function lRoute(a: Cell, b: Cell): Cell[] {
  const out: Cell[] = [{ ...a }];
  let { x, y } = a;
  while (x !== b.x) {
    x += Math.sign(b.x - x);
    out.push({ x, y });
  }
  while (y !== b.y) {
    y += Math.sign(b.y - y);
    out.push({ x, y });
  }
  return out;
}

/** Orthogonal A* on the cell grid from `a` to `b`, avoiding obstacles and penalising bends. */
export function routeCells(a: Cell, b: Cell, obstacles: Bounds[], margin = 10): Cell[] {
  if (sameCell(a, b)) return [{ ...a }];
  const minX = Math.min(a.x, b.x) - margin;
  const maxX = Math.max(a.x, b.x) + margin;
  const minY = Math.min(a.y, b.y) - margin;
  const maxY = Math.max(a.y, b.y) + margin;
  const W = maxX - minX + 1;
  const H = maxY - minY + 1;

  const blocked = new Uint8Array(W * H);
  for (const r of obstacles) {
    const x0 = Math.max(r.x, minX);
    const x1 = Math.min(r.x + r.w - 1, maxX);
    const y0 = Math.max(r.y, minY);
    const y1 = Math.min(r.y + r.h - 1, maxY);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) blocked[(y - minY) * W + (x - minX)] = 1;
  }
  const startCell = (a.y - minY) * W + (a.x - minX);
  const goalCell = (b.y - minY) * W + (b.x - minX);
  blocked[startCell] = 0;
  blocked[goalCell] = 0;

  const bx = b.x - minX;
  const by = b.y - minY;
  const heuristic = (state: number) => {
    const c = (state / STATES) | 0;
    return Math.abs((c % W) - bx) + Math.abs(((c / W) | 0) - by);
  };
  const N = W * H * STATES;
  const cost = new Float32Array(N).fill(Infinity);
  const prev = new Int32Array(N).fill(-1);
  const heap = new MinHeap();
  const start = startCell * STATES + START;
  cost[start] = 0;
  heap.push(heuristic(start), start);

  let goal = -1;
  while (heap.size) {
    const [f, state] = heap.pop();
    const g = cost[state];
    if (f > g + heuristic(state) + 1e-3) continue; // stale entry
    const c = (state / STATES) | 0;
    if (c === goalCell) {
      goal = state;
      break;
    }
    const arrived = state % STATES;
    const cx = c % W;
    const cy = (c / W) | 0;
    for (let d = 0; d < 4; d++) {
      const nx = cx + DIRECTIONS[d].x;
      const ny = cy + DIRECTIONS[d].y;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const next = ny * W + nx;
      if (blocked[next]) continue;
      const ng = g + 1 + (arrived !== START && arrived !== d ? BEND_COST : 0);
      const nextState = next * STATES + d;
      if (ng < cost[nextState]) {
        cost[nextState] = ng;
        prev[nextState] = state;
        heap.push(ng + heuristic(nextState), nextState);
      }
    }
  }
  if (goal < 0) return lRoute(a, b);
  const out: Cell[] = [];
  for (let state = goal; state !== -1; state = prev[state]) {
    const c = (state / STATES) | 0;
    out.push({ x: minX + (c % W), y: minY + ((c / W) | 0) });
  }
  return out.reverse();
}

/** Keeps the ends, real bends and U-turns (a waypoint past the end of a run must stay on the line). */
export function simplify(cells: Cell[]): Cell[] {
  if (cells.length < 3) return cells;
  const out = [cells[0]];
  for (let i = 1; i < cells.length - 1; i++) {
    const p = out[out.length - 1];
    const c = cells[i];
    const n = cells[i + 1];
    const cross = (c.x - p.x) * (n.y - c.y) - (c.y - p.y) * (n.x - c.x);
    const dot = (c.x - p.x) * (n.x - c.x) + (c.y - p.y) * (n.y - c.y);
    if (cross !== 0 || dot < 0) out.push(c);
  }
  out.push(cells[cells.length - 1]);
  return out;
}

/** Routes through consecutive points, joined into one cell path without repeated cells. */
export function routeThrough(points: Cell[], obstacles: Bounds[]) {
  const legs: Cell[][] = [];
  const cells: Cell[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const leg = routeCells(points[i], points[i + 1], obstacles);
    legs.push(leg);
    for (const p of leg) if (!sameCell(cells[cells.length - 1], p)) cells.push(p);
  }
  return { legs, cells };
}

/** What a cable routes around: custom objects, except the ones it is attached to (or about to be). */
export const cableObstacles = (parts: Part[], ...exclude: (string | undefined)[]) =>
  parts.filter((p) => p.kind === 'object' && !exclude.includes(p.id));

/** Routes every cable around custom objects (other than the ones it is attached to). */
export function computeRoutes(doc: Doc): Map<string, Route> {
  const byId = partsById(doc.objects);
  const channels = shapedChannels(doc.objects);
  const routes = new Map<string, Route>();
  for (const cable of doc.cables) {
    const start = anchorCell(cable.a, byId);
    const end = anchorCell(cable.b, byId);
    if (!start || !end) continue;
    const obstacles = cableObstacles(doc.objects, cable.a.objId, cable.b.objId);
    const pts = [start, ...cable.waypoints, end];
    const { legs, cells } = routeThrough(pts, obstacles);
    const draw = simplify(cells);
    const steps = cells.length - 1;
    routes.set(cable.id, {
      segs: legs,
      pts,
      draw,
      d: cablePath(cells, channels),
      steps,
      bends: Math.max(0, draw.length - 2),
      mm: steps * CELL_MM + cable.slackMm,
    });
  }
  return routes;
}

const routeCache = new WeakMap<Doc, Map<string, Route>>();

/** `computeRoutes`, computed once per layout and shared by every component that draws or measures cables. */
export function routesFor(doc: Doc): Map<string, Route> {
  let routes = routeCache.get(doc);
  if (!routes) {
    routes = computeRoutes(doc);
    routeCache.set(doc, routes);
  }
  return routes;
}

/** Index of the leg of `route` nearest to `cell` (where a new waypoint goes). */
export function nearestLeg(route: Route, cell: Cell) {
  let index = 0;
  let best = Infinity;
  route.segs.forEach((leg, i) =>
    leg.forEach((p) => {
      const distance = Math.abs(p.x - cell.x) + Math.abs(p.y - cell.y);
      if (distance < best) {
        best = distance;
        index = i;
      }
    }),
  );
  return index;
}

/** SVG path of a routed cable: following channel shapes when it crosses any, else rounded through its corners. */
export const routePath = (route: Route) => route.d || cellPath(route.draw);
