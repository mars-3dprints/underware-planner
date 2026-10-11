import type { Cell, Obj } from './types';
import { portsList } from './geometry';

type P = { x: number; y: number };
const R = 0.32; // corner radius (cells) for cable bends outside channels

/** Rounded-corner path through world points (collinear points dropped). Returns commands after the first point. */
function rounded(pts: P[]): string {
  const Q = pts.filter((p, i) => {
    if (i === 0 || i === pts.length - 1) return true;
    const a = pts[i - 1],
      b = pts[i + 1];
    return (p.x - a.x) * (b.y - p.y) - (p.y - a.y) * (b.x - p.x) !== 0;
  });
  let d = '';
  for (let i = 1; i < Q.length - 1; i++) {
    const p = Q[i - 1],
      c = Q[i],
      n = Q[i + 1];
    const r = Math.min(R, Math.hypot(c.x - p.x, c.y - p.y) / 2, Math.hypot(n.x - c.x, n.y - c.y) / 2);
    const u1 = { x: Math.sign(c.x - p.x), y: Math.sign(c.y - p.y) },
      u2 = { x: Math.sign(n.x - c.x), y: Math.sign(n.y - c.y) };
    d += ` L${c.x - u1.x * r} ${c.y - u1.y * r} Q${c.x} ${c.y} ${c.x + u2.x * r} ${c.y + u2.y * r}`;
  }
  const l = Q[Q.length - 1];
  return d + ` L${l.x} ${l.y}`;
}

type Pt = [number, number];
const arc = (cx: number, cy: number, r: number, a0: number, a1: number, N = 14): Pt[] =>
  Array.from({ length: N + 1 }, (_, i) => {
    const a = ((a0 + ((a1 - a0) * i) / N) * Math.PI) / 180;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)] as Pt;
  });
/** Rounded quarter turn of radius `rho` between two openings that are not opposite (junction corners). */
function cornerLine(A: Pt, ua: Pt, B: Pt, vb: Pt, rho = 0.5): Pt[] {
  const t = (B[0] - A[0]) * ua[0] + (B[1] - A[1]) * ua[1];
  const C: Pt = [A[0] + ua[0] * t, A[1] + ua[1] * t];
  const p1: Pt = [C[0] - ua[0] * rho, C[1] - ua[1] * rho],
    p2: Pt = [C[0] + vb[0] * rho, C[1] + vb[1] * rho];
  const c: Pt = [p1[0] + vb[0] * rho, p1[1] + vb[1] * rho];
  const a0 = (Math.atan2(p1[1] - c[1], p1[0] - c[0]) * 180) / Math.PI;
  let a1 = (Math.atan2(p2[1] - c[1], p2[0] - c[0]) * 180) / Math.PI;
  while (a1 - a0 > 180) a1 -= 360;
  while (a1 - a0 < -180) a1 += 360;
  return [A, ...arc(c[0], c[1], rho, a0, a1, 10), B];
}
/** Centerline of a channel piece between two of its openings, in the piece's own frame (null: no such path). */
function shapeLine(
  sub: string,
  n: number,
  ports: [number, number, number, number][],
  ia: number,
  ib: number,
): Pt[] | null {
  const key = Math.min(ia, ib) + '-' + Math.max(ia, ib),
    rev = ia > ib;
  let L: Pt[] | null = null;
  const jog = (): Pt[] => [
    [0.5, 0],
    [0.5, 1],
    ...arc(1, 1, 0.5, 180, 90, 10),
    ...arc(1, 2, 0.5, 270, 360, 10),
    [1.5, 2],
    [1.5, 3],
  ];
  switch (sub) {
    case 'turn':
    case 'angled':
      if (n < 2)
        L = [
          [0, 0.5],
          [0.5, 0.5],
          [0.5, 1],
        ];
      else
        L =
          sub === 'turn'
            ? [[0, 0.5], [1, 0.5], ...arc(1, n - 1, n - 1.5, 270, 360, 18), [n - 0.5, n]]
            : [
                [0, 0.5],
                [1, 0.5],
                [n - 0.5, n - 1],
                [n - 0.5, n],
              ];
      break;
    case 'jog_round':
      L = key === '0-1' ? jog() : null;
      break;
    case 'jog_angled':
      L =
        key === '0-1'
          ? [
              [0.5, 0],
              [0.5, 1],
              [1.5, 2],
              [1.5, 3],
            ]
          : null;
      break;
    case 'y_round':
      L =
        key === '0-2'
          ? jog()
          : key === '1-2'
            ? [
                [1.5, 0],
                [1.5, 3],
              ]
            : null;
      break;
    case 'y_angled':
      L =
        key === '0-2'
          ? [
              [0.5, 0],
              [0.5, 1],
              [1.5, 2],
              [1.5, 3],
            ]
          : key === '1-2'
            ? [
                [1.5, 0],
                [1.5, 3],
              ]
            : null;
      break;
    case 'cap':
      L = [[0, 0.5], [1, 0.5], ...arc(1, 1, 0.5, 270, 360, 10)];
      break;
    case 'fork_round':
      L =
        key === '0-2'
          ? [[0, 0.5], [1, 0.5], ...arc(1, 1, 0.5, 270, 360, 10), ...arc(2, 1, 0.5, 180, 90, 10), [3, 1.5]]
          : key === '1-2'
            ? [[0, 2.5], [1, 2.5], ...arc(1, 2, 0.5, 90, 0, 10), ...arc(2, 2, 0.5, 180, 270, 10), [3, 1.5]]
            : null;
      break;
    case 'fork_angled':
      L =
        key === '0-2'
          ? [
              [0, 0.5],
              [1, 0.5],
              [2, 1.5],
              [3, 1.5],
            ]
          : key === '1-2'
            ? [
                [0, 2.5],
                [1, 2.5],
                [2, 1.5],
                [3, 1.5],
              ]
            : null;
      break;
    case 't':
    case 'cross':
    case 'cross1': {
      const A = ports[ia],
        B = ports[ib];
      if (A[2] === -B[2] && A[3] === -B[3])
        L = [
          [A[0], A[1]],
          [B[0], B[1]],
        ];
      else L = cornerLine([A[0], A[1]], [-A[2], -A[3]], [B[0], B[1]], [B[2], B[3]], 0.5);
      return L; // already oriented ia -> ib
    }
  }
  if (!L) return null;
  // canonical lists run from the lower-numbered opening to the higher; fork/y/jog/cap/turn all follow port order
  return rev ? [...L].reverse() : L;
}

interface WPort {
  pt: P;
  dx: number;
  dy: number;
  cell: Cell;
  out: Cell;
  idx: number;
}
function worldPorts(o: Obj): {
  ports: WPort[];
  m: [number, number, number, number, number, number] | null;
  local: [number, number, number, number][];
} {
  const { ports, m } = portsList(o);
  if (!m) return { ports: [], m: null, local: [] };
  return {
    local: ports as [number, number, number, number][],
    m,
    ports: ports.map(([x, y, dx, dy], idx) => {
      const pt = { x: m[0] * x + m[2] * y + m[4], y: m[1] * x + m[3] * y + m[5] };
      const wx = Math.round(m[0] * dx + m[2] * dy),
        wy = Math.round(m[1] * dx + m[3] * dy);
      const cell = { x: Math.floor(pt.x - wx * 0.25), y: Math.floor(pt.y - wy * 0.25) };
      return { pt, dx: wx, dy: wy, cell, out: { x: cell.x + wx, y: cell.y + wy }, idx };
    }),
  };
}
const same = (a: Cell | undefined, b: Cell) => !!a && a.x === b.x && a.y === b.y;
const inside = (o: Obj, c: Cell) => c.x >= o.x && c.x < o.x + o.w && c.y >= o.y && c.y < o.y + o.h;

/**
 * Cable path (SVG) for a route. Wherever the cable enters a shaped channel through one opening and leaves through another,
 * it follows the channel's own curve; everywhere else it keeps the default rounded orthogonal look.
 * `all` is the cable's cell-by-cell path.
 */
export function cablePathD(all: Cell[], channels: Obj[]): string {
  const shaped = channels
    .filter((o) => o.kind === 'raceway' && o.sub !== 'straight' && o.sub !== 'bridge')
    .map((o) => ({ o, ...worldPorts(o) }))
    .filter((s) => s.ports.length > 1);
  const cs = (c: Cell): P => ({ x: c.x + 0.5, y: c.y + 0.5 });
  // find replaceable runs
  const runs: { i: number; j: number; a: WPort; b: WPort; sh: (typeof shaped)[number] }[] = [];
  for (let i = 1; i < all.length - 1;) {
    let hit: (typeof runs)[number] | undefined;
    for (const sh of shaped) {
      const { o, ports } = sh;
      if (!inside(o, all[i])) continue;
      for (const a of ports) {
        if (!same(all[i], a.cell) || !same(all[i - 1], a.out)) continue;
        let j = i;
        while (j < all.length - 1 && inside(o, all[j])) {
          const b = ports.find((q) => q !== a && same(all[j], q.cell) && same(all[j + 1], q.out));
          if (b && shapeLine(o.sub!, o.w, sh.local, a.idx, b.idx)) {
            hit = { i, j, a, b, sh };
            break;
          }
          j++;
        }
        if (hit) break;
      }
      if (hit) break;
    }
    if (hit) {
      runs.push(hit);
      i = hit.j + 1;
    } else i++;
  }
  if (!runs.length) return '';
  let d = `M${cs(all[0]).x} ${cs(all[0]).y}`;
  let cur: P = cs(all[0]),
    from = 1;
  for (const { i, j, a, b, sh } of runs) {
    d += rounded([cur, ...all.slice(from, i).map(cs), a.pt]);
    const L = shapeLine(sh.o.sub!, sh.o.w, sh.local, a.idx, b.idx)!,
      m = sh.m!;
    for (const [x, y] of L.slice(1))
      d += ` L${+(m[0] * x + m[2] * y + m[4]).toFixed(4)} ${+(m[1] * x + m[3] * y + m[5]).toFixed(4)}`;
    cur = b.pt;
    from = j + 1;
  }
  return d + rounded([cur, ...all.slice(from).map(cs)]);
}
