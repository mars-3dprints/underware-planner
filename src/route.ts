import { cablePathD } from './follow';
import type { Anchor, Cell, Doc, Obj } from './types';
import { CELL_MM } from './types';

export interface Rect { x: number; y: number; w: number; h: number }
export interface Route { segs: Cell[][]; pts: Cell[]; draw: Cell[]; d: string; steps: number; bends: number; mm: number }

const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]];
const TURN = 1.2; // penalty per bend -> prefers straight runs

class MinHeap {
  k: number[] = []; v: number[] = [];
  get size() { return this.k.length; }
  push(key: number, val: number) {
    const { k, v } = this; let i = k.length; k.push(key); v.push(val);
    while (i > 0) { const p = (i - 1) >> 1; if (k[p] <= key) break; k[i] = k[p]; v[i] = v[p]; i = p; }
    k[i] = key; v[i] = val;
  }
  pop(): [number, number] {
    const { k, v } = this; const rk = k[0], rv = v[0];
    const lk = k.pop()!, lv = v.pop()!;
    if (k.length) {
      let i = 0; const n = k.length;
      for (;;) {
        let c = 2 * i + 1; if (c >= n) break;
        if (c + 1 < n && k[c + 1] < k[c]) c++;
        if (k[c] >= lk) break;
        k[i] = k[c]; v[i] = v[c]; i = c;
      }
      k[i] = lk; v[i] = lv;
    }
    return [rk, rv];
  }
}

function lRoute(a: Cell, b: Cell): Cell[] {
  const out: Cell[] = [{ ...a }]; let { x, y } = a;
  while (x !== b.x) { x += Math.sign(b.x - x); out.push({ x, y }); }
  while (y !== b.y) { y += Math.sign(b.y - y); out.push({ x, y }); }
  return out;
}

/** Orthogonal A* on the cell grid, avoiding obstacle rects, penalising bends. */
export function routeCells(a: Cell, b: Cell, obstacles: Rect[], margin = 10): Cell[] {
  if (a.x === b.x && a.y === b.y) return [{ ...a }];
  const minX = Math.min(a.x, b.x) - margin, maxX = Math.max(a.x, b.x) + margin;
  const minY = Math.min(a.y, b.y) - margin, maxY = Math.max(a.y, b.y) + margin;
  const W = maxX - minX + 1, H = maxY - minY + 1;
  const blocked = new Uint8Array(W * H);
  for (const r of obstacles) {
    const x0 = Math.max(r.x, minX), x1 = Math.min(r.x + r.w - 1, maxX);
    const y0 = Math.max(r.y, minY), y1 = Math.min(r.y + r.h - 1, maxY);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) blocked[(y - minY) * W + (x - minX)] = 1;
  }
  const ai = (a.y - minY) * W + (a.x - minX), bi = (b.y - minY) * W + (b.x - minX);
  blocked[ai] = 0; blocked[bi] = 0;
  const bx = b.x - minX, by = b.y - minY;
  const hf = (s: number) => { const c = (s / 5) | 0; return Math.abs((c % W) - bx) + Math.abs(((c / W) | 0) - by); };
  const N = W * H * 5;
  const g = new Float32Array(N).fill(Infinity), prev = new Int32Array(N).fill(-1);
  const heap = new MinHeap();
  const s0 = ai * 5 + 4; g[s0] = 0; heap.push(hf(s0), s0);
  let goal = -1;
  while (heap.size) {
    const [f, s] = heap.pop();
    const gs = g[s];
    if (f > gs + hf(s) + 1e-3) continue; // stale
    const c = (s / 5) | 0;
    if (c === bi) { goal = s; break; }
    const dir = s % 5, cx = c % W, cy = (c / W) | 0;
    for (let d = 0; d < 4; d++) {
      const nx = cx + DIRS[d][0], ny = cy + DIRS[d][1];
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const ni = ny * W + nx; if (blocked[ni]) continue;
      const ng = gs + 1 + (dir !== 4 && dir !== d ? TURN : 0), ns = ni * 5 + d;
      if (ng < g[ns]) { g[ns] = ng; prev[ns] = s; heap.push(ng + hf(ns), ns); }
    }
  }
  if (goal < 0) return lRoute(a, b);
  const out: Cell[] = [];
  for (let s = goal; s !== -1; s = prev[s]) { const c = (s / 5) | 0; out.push({ x: minX + (c % W), y: minY + ((c / W) | 0) }); }
  return out.reverse();
}

export function simplify(pts: Cell[]): Cell[] {
  if (pts.length < 3) return pts;
  const out = [pts[0]];
  for (let i = 1; i < pts.length - 1; i++) {
    const p = out[out.length - 1], c = pts[i], n = pts[i + 1];
    const cross = (c.x - p.x) * (n.y - c.y) - (c.y - p.y) * (n.x - c.x), dot = (c.x - p.x) * (n.x - c.x) + (c.y - p.y) * (n.y - c.y);
    if (cross !== 0 || dot < 0) out.push(c); // keep real bends and U-turns (a waypoint past the end of a run must stay on the line)
  }
  out.push(pts[pts.length - 1]);
  return out;
}

export function anchorCell(a: Anchor, byId: Map<string, Obj>): Cell | null {
  if (a.objId === undefined) return { x: a.x, y: a.y };
  const o = byId.get(a.objId);
  return o ? { x: o.x + a.dx, y: o.y + a.dy } : null;
}

export function computeRoutes(doc: Doc): Map<string, Route> {
  const byId = new Map(doc.objects.map((o) => [o.id, o]));
  const res = new Map<string, Route>();
  for (const c of doc.cables) {
    const ca = anchorCell(c.a, byId), cb = anchorCell(c.b, byId);
    if (!ca || !cb) continue;
    const obst = doc.objects.filter((o) => o.kind === 'object' && o.id !== c.a.objId && o.id !== c.b.objId);
    const pts: Cell[] = [ca, ...c.waypoints, cb];
    const segs: Cell[][] = []; const all: Cell[] = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const s = routeCells(pts[i], pts[i + 1], obst);
      segs.push(s);
      for (const p of s) { const l = all[all.length - 1]; if (!l || l.x !== p.x || l.y !== p.y) all.push(p); }
    }
    const draw = simplify(all);
    const steps = all.length - 1;
    res.set(c.id, { segs, pts, draw, d: cablePathD(all, doc.objects), steps, bends: Math.max(0, draw.length - 2), mm: steps * CELL_MM + c.slackMm });
  }
  return res;
}
