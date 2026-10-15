import { contains, sameCell } from '../domain/anchors';
import { applyMatrix, channelPorts, type Matrix } from '../domain/geometry';
import type { Port } from '../domain/ports';
import type { Cell, Part, PieceType } from '../domain/types';
import { cellCenter, roundedLegs } from './paths';

type Vec = [number, number];

/** Rounded path through world points, dropping collinear ones. Returns the commands after the first point. */
function roundedThrough(points: Cell[]): string {
  const corners = points.filter((p, i) => {
    if (i === 0 || i === points.length - 1) return true;
    const a = points[i - 1];
    const b = points[i + 1];
    return (p.x - a.x) * (b.y - p.y) - (p.y - a.y) * (b.x - p.x) !== 0;
  });
  return roundedLegs(corners);
}

/** Points along an arc centred on (cx, cy), from angle a0 to a1 in degrees. */
const arc = (cx: number, cy: number, r: number, a0: number, a1: number, steps = 14): Vec[] =>
  Array.from({ length: steps + 1 }, (_, i) => {
    const a = ((a0 + ((a1 - a0) * i) / steps) * Math.PI) / 180;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)] as Vec;
  });

/** Rounded quarter turn of radius `rho` between two openings that are not opposite (junction corners). */
function cornerLine(A: Vec, ua: Vec, B: Vec, vb: Vec, rho = 0.5): Vec[] {
  const t = (B[0] - A[0]) * ua[0] + (B[1] - A[1]) * ua[1];
  const C: Vec = [A[0] + ua[0] * t, A[1] + ua[1] * t];
  const p1: Vec = [C[0] - ua[0] * rho, C[1] - ua[1] * rho];
  const p2: Vec = [C[0] + vb[0] * rho, C[1] + vb[1] * rho];
  const c: Vec = [p1[0] + vb[0] * rho, p1[1] + vb[1] * rho];
  const a0 = (Math.atan2(p1[1] - c[1], p1[0] - c[0]) * 180) / Math.PI;
  let a1 = (Math.atan2(p2[1] - c[1], p2[0] - c[0]) * 180) / Math.PI;
  while (a1 - a0 > 180) a1 -= 360;
  while (a1 - a0 < -180) a1 += 360;
  return [A, ...arc(c[0], c[1], rho, a0, a1, 10), B];
}

const roundJog = (): Vec[] => [
  [0.5, 0],
  [0.5, 1],
  ...arc(1, 1, 0.5, 180, 90, 10),
  ...arc(1, 2, 0.5, 270, 360, 10),
  [1.5, 2],
  [1.5, 3],
];
const angledJog = (): Vec[] => [
  [0.5, 0],
  [0.5, 1],
  [1.5, 2],
  [1.5, 3],
];
const mergeStraight = (): Vec[] => [
  [1.5, 0],
  [1.5, 3],
];

/**
 * Centerline of a piece from opening `from` to opening `to`, in the piece's own frame, or null when the piece
 * has no path between them. Lists run from the lower-numbered opening to the higher and are reversed as needed.
 */
function centerline(type: PieceType, n: number, ports: Port[], from: number, to: number): Vec[] | null {
  const pair = `${Math.min(from, to)}-${Math.max(from, to)}`;
  let line: Vec[] | null = null;
  switch (type) {
    case 'turn':
    case 'angled':
      if (n < 2)
        line = [
          [0, 0.5],
          [0.5, 0.5],
          [0.5, 1],
        ];
      else if (type === 'turn')
        line = [[0, 0.5], [1, 0.5], ...arc(1, n - 1, n - 1.5, 270, 360, 18), [n - 0.5, n]];
      else
        line = [
          [0, 0.5],
          [1, 0.5],
          [n - 0.5, n - 1],
          [n - 0.5, n],
        ];
      break;
    case 'jog_round':
      line = pair === '0-1' ? roundJog() : null;
      break;
    case 'jog_angled':
      line = pair === '0-1' ? angledJog() : null;
      break;
    case 'y_round':
      line = pair === '0-2' ? roundJog() : pair === '1-2' ? mergeStraight() : null;
      break;
    case 'y_angled':
      line = pair === '0-2' ? angledJog() : pair === '1-2' ? mergeStraight() : null;
      break;
    case 'cap':
      line = [[0, 0.5], [1, 0.5], ...arc(1, 1, 0.5, 270, 360, 10)];
      break;
    case 'fork_round':
      line =
        pair === '0-2'
          ? [[0, 0.5], [1, 0.5], ...arc(1, 1, 0.5, 270, 360, 10), ...arc(2, 1, 0.5, 180, 90, 10), [3, 1.5]]
          : pair === '1-2'
            ? [[0, 2.5], [1, 2.5], ...arc(1, 2, 0.5, 90, 0, 10), ...arc(2, 2, 0.5, 180, 270, 10), [3, 1.5]]
            : null;
      break;
    case 'fork_angled':
      line =
        pair === '0-2'
          ? [
              [0, 0.5],
              [1, 0.5],
              [2, 1.5],
              [3, 1.5],
            ]
          : pair === '1-2'
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
    case 't_inline':
    case 'cross_inline':
    case 'open':
    case 'open_side':
    case 'bridge':
    case 'half_bridge':
    case 't_end': {
      // Junctions, open channels and bridges: straight across between opposite openings, a quarter arc
      // otherwise. Already oriented.
      const [ax, ay, adx, ady] = ports[from];
      const [bx, by, bdx, bdy] = ports[to];
      if (adx === -bdx && ady === -bdy)
        return [
          [ax, ay],
          [bx, by],
        ];
      return cornerLine([ax, ay], [-adx, -ady], [bx, by], [bdx, bdy], 0.5);
    }
  }
  if (!line) return null;
  return from > to ? [...line].reverse() : line;
}

/** An opening in world space: its point, outward direction, the cell just inside and the cell just outside. */
interface WorldPort {
  point: Cell;
  dx: number;
  dy: number;
  cell: Cell;
  out: Cell;
  index: number;
}

export interface ShapedChannel {
  part: Part;
  ports: WorldPort[];
  m: Matrix;
  local: Port[];
}

function shapedChannel(part: Part): ShapedChannel | null {
  const { ports, m } = channelPorts(part);
  if (!m) return null;
  return {
    part,
    m,
    local: ports,
    ports: ports.map(([x, y, dx, dy], index) => {
      const point = applyMatrix(m, x, y);
      const wx = Math.round(m[0] * dx + m[2] * dy);
      const wy = Math.round(m[1] * dx + m[3] * dy);
      const cell = { x: Math.floor(point.x - wx * 0.25), y: Math.floor(point.y - wy * 0.25) };
      return { point, dx: wx, dy: wy, cell, out: { x: cell.x + wx, y: cell.y + wy }, index };
    }),
  };
}

type Run = { i: number; j: number; a: WorldPort; b: WorldPort; channel: ShapedChannel; line: Vec[] };

const lineOf = (run: { channel: ShapedChannel; a: WorldPort; b: WorldPort }) =>
  centerline(run.channel.part.sub!, run.channel.part.w, run.channel.local, run.a.index, run.b.index);

/** Channels a cable can follow: shaped pieces with at least two openings. Build once per layout. */
export const shapedChannels = (parts: Part[]): ShapedChannel[] =>
  parts
    .filter((p) => p.kind === 'raceway')
    .map(shapedChannel)
    .filter((c): c is ShapedChannel => !!c && c.ports.length > 1);

/**
 * SVG path for a cable's cell-by-cell route. Wherever the route enters a shaped channel through one opening and
 * leaves through another, the cable follows that channel's centerline; elsewhere it keeps the rounded orthogonal
 * look. Returns '' when the route crosses no shaped channel.
 */
export function cablePath(cells: Cell[], channels: ShapedChannel[]): string {
  // Find the runs of cells that pass through a channel from one opening to another.
  const runs: Run[] = [];
  for (let i = 1; i < cells.length - 1;) {
    const run = findRun(cells, i, channels);
    if (run) {
      runs.push(run);
      i = run.j + 1;
    } else {
      i++;
    }
  }
  if (!runs.length) return '';

  let d = `M${cellCenter(cells[0]).x} ${cellCenter(cells[0]).y}`;
  let current = cellCenter(cells[0]);
  let from = 1;
  for (const run of runs) {
    d += roundedThrough([current, ...cells.slice(from, run.i).map(cellCenter), run.a.point]);
    const m = run.channel.m;
    for (const [x, y] of run.line.slice(1)) {
      d += ` L${+(m[0] * x + m[2] * y + m[4]).toFixed(4)} ${+(m[1] * x + m[3] * y + m[5]).toFixed(4)}`;
    }
    current = run.b.point;
    from = run.j + 1;
  }
  return d + roundedThrough([current, ...cells.slice(from).map(cellCenter)]);
}

/** A run starting at cells[i]: entering a channel through an opening and leaving through another with a path. */
function findRun(cells: Cell[], i: number, channels: ShapedChannel[]): Run | undefined {
  for (const channel of channels) {
    const { part, ports } = channel;
    if (!contains(part, cells[i])) continue;
    for (const a of ports) {
      if (!sameCell(cells[i], a.cell) || !sameCell(cells[i - 1], a.out)) continue;
      for (let j = i; j < cells.length - 1 && contains(part, cells[j]); j++) {
        const b = ports.find((q) => q !== a && sameCell(cells[j], q.cell) && sameCell(cells[j + 1], q.out));
        const line = b && lineOf({ channel, a, b });
        if (line) return { i, j, a, b: b!, channel, line };
      }
    }
  }
  return undefined;
}
