import { uid } from './id';
import { isLinear, isShaped } from './pieces';
import { anchorCell, partsById } from './anchors';
import type { Anchor, Bounds, Cable, Cell, Doc, Part } from './types';

function boundsOfRects(rects: Bounds[]): Bounds {
  let x0 = Infinity,
    y0 = Infinity,
    x1 = -Infinity,
    y1 = -Infinity;
  for (const r of rects) {
    x0 = Math.min(x0, r.x);
    y0 = Math.min(y0, r.y);
    x1 = Math.max(x1, r.x + r.w);
    y1 = Math.max(y1, r.y + r.h);
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

export const boundsOf = (parts: Part[]): Bounds => boundsOfRects(parts);

/** Bounds of parts plus the points of cables (waypoints and loose ends), in cells. */
export function selectionBounds(parts: Part[], cables: Cable[]): Bounds {
  const rects: Bounds[] = parts.map(({ x, y, w, h }) => ({ x, y, w, h }));
  for (const cable of cables) {
    const looseEnds = [cable.a, cable.b].flatMap((end) =>
      end.objId === undefined ? [{ x: end.x, y: end.y }] : [],
    );
    for (const p of [...cable.waypoints, ...looseEnds]) rects.push({ x: p.x, y: p.y, w: 1, h: 1 });
  }
  return boundsOfRects(rects);
}

/** Cables running only between parts of a group: every attached end is in the group, and at least one is attached. */
export const internalCables = (cables: Cable[], partIds: Set<string>) =>
  cables.filter(
    (c) =>
      (c.a.objId !== undefined || c.b.objId !== undefined) &&
      [c.a, c.b].every((end) => end.objId === undefined || partIds.has(end.objId)),
  );

/** Cables that travel with a selection: the selected ones plus the internal ones. */
export function carriedCables(cables: Cable[], partIds: Set<string>, cableIds: Set<string>) {
  const internal = new Set(internalCables(cables, partIds).map((c) => c.id));
  return cables.filter((c) => cableIds.has(c.id) || internal.has(c.id));
}

/** Applies `f` to a loose end; attached ends follow their part. */
const mapLoose = (end: Anchor, f: (c: Cell) => Cell): Anchor =>
  end.objId === undefined ? { ...f({ x: end.x, y: end.y }) } : end;

function shiftCable(cable: Cable, dx: number, dy: number): Cable {
  const shift = (p: Cell) => ({ x: p.x + dx, y: p.y + dy });
  return {
    ...cable,
    a: mapLoose(cable.a, shift),
    b: mapLoose(cable.b, shift),
    waypoints: cable.waypoints.map(shift),
  };
}

export function moveGroup(doc: Doc, partIds: string[], cableIds: string[], dx: number, dy: number): Doc {
  if (!dx && !dy) return doc;
  const parts = new Set(partIds);
  const moving = new Set(carriedCables(doc.cables, parts, new Set(cableIds)).map((c) => c.id));
  return {
    objects: doc.objects.map((p) => (parts.has(p.id) ? { ...p, x: p.x + dx, y: p.y + dy } : p)),
    cables: doc.cables.map((c) => (moving.has(c.id) ? shiftCable(c, dx, dy) : c)),
  };
}

const span = (cells: Cell[]) => ({
  x0: Math.min(...cells.map((p) => p.x)),
  x1: Math.max(...cells.map((p) => p.x)),
  y0: Math.min(...cells.map((p) => p.y)),
  y1: Math.max(...cells.map((p) => p.y)),
});

/** Quarter turn of cables on their own: loose ends and waypoints swing round, attached ends stay put. */
function rotateCables(doc: Doc, moving: Cable[]): Doc {
  const movable = moving.some(
    (c) => c.waypoints.length || c.a.objId === undefined || c.b.objId === undefined,
  );
  if (!movable) return doc;
  const byId = partsById(doc.objects);
  const held: Cell[] = [];
  const loose: Cell[] = [];
  for (const cable of moving) {
    loose.push(...cable.waypoints);
    for (const end of [cable.a, cable.b]) {
      if (end.objId === undefined) {
        loose.push({ x: end.x, y: end.y });
      } else {
        const cell = anchorCell(end, byId);
        if (cell) held.push(cell);
      }
    }
  }
  let turn: (p: Cell) => Cell;
  if (held.length) {
    // Pivot on the attached ends: they never move, so four turns always return to the start.
    const { x0, x1, y0, y1 } = span(held);
    const cx2 = Math.round(x0 + x1);
    let cy2 = Math.round(y0 + y1);
    if ((cx2 + cy2) % 2 !== 0) cy2 += 1; // keep the pivot on the lattice
    const sx = (cx2 + cy2) / 2;
    const sy = (cy2 - cx2) / 2;
    turn = (p) => ({ x: sx - p.y, y: sy + p.x });
  } else {
    // Everything is loose: turn inside its own bounding box, nudged to keep the middle in place.
    const { x0, x1, y0, y1 } = span(loose);
    const w = x1 - x0 + 1;
    const h = y1 - y0 + 1;
    const t = Math.trunc((w - h) / 2);
    turn = (p) => ({ x: x0 + h - 1 - (p.y - y0) + t, y: y0 + (p.x - x0) - t });
  }
  return {
    ...doc,
    cables: doc.cables.map((c) =>
      moving.includes(c)
        ? { ...c, a: mapLoose(c.a, turn), b: mapLoose(c.b, turn), waypoints: c.waypoints.map(turn) }
        : c,
    ),
  };
}

/** Quarter turn clockwise about the middle of the group. */
export function rotateGroup(doc: Doc, partIds: string[], cableIds: string[] = []): Doc {
  const ids = new Set(partIds);
  const parts = doc.objects.filter((p) => ids.has(p.id));
  const moving = carriedCables(doc.cables, ids, new Set(cableIds));
  if (!parts.length && !moving.length) return doc;
  if (!parts.length) return rotateCables(doc, moving);

  const box = selectionBounds(parts, moving);
  const partsById = new Map(parts.map((p) => [p.id, p]));
  const movingIds = new Set(moving.map((c) => c.id));
  const turn = (c: Cell): Cell => ({ x: box.x + box.h - 1 - (c.y - box.y), y: box.y + (c.x - box.x) });
  const turnEnd = (end: Anchor, loose: boolean): Anchor => {
    if (end.objId === undefined) return loose ? mapLoose(end, turn) : end;
    const part = partsById.get(end.objId);
    return part ? { ...end, dx: part.h - 1 - end.dy, dy: end.dx } : end;
  };
  return {
    objects: doc.objects.map((p) =>
      ids.has(p.id)
        ? {
            ...p,
            x: box.x + box.h - (p.y - box.y) - p.h,
            y: box.y + (p.x - box.x),
            w: p.h,
            h: p.w,
            rot: isShaped(p.sub) || isLinear(p.sub) ? ((p.rot ?? 0) + 1) % 4 : p.rot,
          }
        : p,
    ),
    cables: doc.cables.map((c) => {
      const loose = movingIds.has(c.id);
      return {
        ...c,
        a: turnEnd(c.a, loose),
        b: turnEnd(c.b, loose),
        waypoints: loose ? c.waypoints.map(turn) : c.waypoints,
      };
    }),
  };
}

/** Copies of parts and cables, shifted by dx, dy, with fresh ids and ends re-attached to the copies. */
export function cloneItems(parts: Part[], cables: Cable[], dx: number, dy: number) {
  const newIds = new Map(parts.map((p) => [p.id, uid()]));
  const cloneEnd = (end: Anchor): Anchor =>
    end.objId === undefined
      ? { x: end.x + dx, y: end.y + dy }
      : { ...end, objId: newIds.get(end.objId) ?? end.objId };
  return {
    parts: parts.map((p) => ({ ...p, id: newIds.get(p.id)!, x: p.x + dx, y: p.y + dy })),
    cables: cables.map((c) => ({
      ...c,
      id: uid(),
      a: cloneEnd(c.a),
      b: cloneEnd(c.b),
      waypoints: c.waypoints.map((p) => ({ x: p.x + dx, y: p.y + dy })),
    })),
  };
}
