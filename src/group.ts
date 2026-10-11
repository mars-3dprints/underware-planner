import type { Anchor, Cable, Cell, Doc, Obj } from './types';
import { isShaped } from './types';

export const uid = () => Math.random().toString(36).slice(2, 9);
export const boxOf = (objs: Obj[]) => {
  let x0 = Infinity,
    y0 = Infinity,
    x1 = -Infinity,
    y1 = -Infinity;
  for (const o of objs) {
    x0 = Math.min(x0, o.x);
    y0 = Math.min(y0, o.y);
    x1 = Math.max(x1, o.x + o.w);
    y1 = Math.max(y1, o.y + o.h);
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
};
/** Bounds of objects plus the points of cables (waypoints and loose ends), in cells. */
export const boxOfAll = (objs: Obj[], cables: Cable[]) => {
  const rects = objs.map((o) => ({ x: o.x, y: o.y, w: o.w, h: o.h }));
  for (const c of cables)
    for (const p of [
      ...c.waypoints,
      ...[c.a, c.b]
        .filter((e) => e.objId === undefined)
        .map((e) => ({ x: (e as any).x as number, y: (e as any).y as number })),
    ])
      rects.push({ x: p.x, y: p.y, w: 1, h: 1 });
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
};
/** Cables that travel with a selection: the selected ones plus any running only between selected objects. */
export const carried = (cables: Cable[], ids: Set<string>, cids: Set<string>) => {
  const inner = new Set(internalCables(cables, ids).map((c) => c.id));
  return cables.filter((c) => cids.has(c.id) || inner.has(c.id));
};

/** A cable travels with a group when every end attached to an object is inside the group (and at least one is). */
export const internalCables = (cables: Cable[], ids: Set<string>) =>
  cables.filter(
    (c) =>
      (c.a.objId !== undefined || c.b.objId !== undefined) &&
      [c.a, c.b].every((e) => e.objId === undefined || ids.has(e.objId)),
  );

const mapCell = (c: Cell, f: (c: Cell) => Cell) => f(c);
const mapFree = (a: Anchor, f: (c: Cell) => Cell): Anchor =>
  a.objId === undefined ? { ...f({ x: a.x, y: a.y }) } : a;
const moveCable = (c: Cable, dx: number, dy: number): Cable => {
  const f = (p: Cell) => ({ x: p.x + dx, y: p.y + dy });
  return { ...c, a: mapFree(c.a, f), b: mapFree(c.b, f), waypoints: c.waypoints.map((p) => mapCell(p, f)) };
};

export function moveGroup(d: Doc, ids: string[], cids: string[], dx: number, dy: number): Doc {
  if (!dx && !dy) return d;
  const set = new Set(ids),
    inner = new Set(carried(d.cables, set, new Set(cids)).map((c) => c.id));
  return {
    objects: d.objects.map((o) => (set.has(o.id) ? { ...o, x: o.x + dx, y: o.y + dy } : o)),
    cables: d.cables.map((c) => (inner.has(c.id) ? moveCable(c, dx, dy) : c)),
  };
}

/** Quarter turn clockwise about the middle of the group. */
export function rotateGroup(d: Doc, ids: string[], cids: string[] = []): Doc {
  const set = new Set(ids),
    sel = d.objects.filter((o) => set.has(o.id));
  const moving = carried(d.cables, set, new Set(cids));
  if (!sel.length && !moving.length) return d;
  if (!sel.length) {
    // cables only: loose ends and points swing a quarter turn; attached ends stay where they are
    if (!moving.some((c) => c.waypoints.length || c.a.objId === undefined || c.b.objId === undefined))
      return d; // nothing movable
    const hold: Cell[] = [],
      free: Cell[] = [];
    for (const c of moving) {
      free.push(...c.waypoints);
      for (const e of [c.a, c.b]) {
        if (e.objId === undefined) free.push({ x: e.x, y: e.y });
        else {
          const o = d.objects.find((q) => q.id === e.objId);
          if (o) hold.push({ x: o.x + e.dx, y: o.y + e.dy });
        }
      }
    }
    let rp: (p: Cell) => Cell;
    if (hold.length) {
      // pivot on the attached end(s): they never move, so turning four times always returns to the start
      const x0 = Math.min(...hold.map((p) => p.x)),
        x1 = Math.max(...hold.map((p) => p.x)),
        y0 = Math.min(...hold.map((p) => p.y)),
        y1 = Math.max(...hold.map((p) => p.y));
      const cx2 = Math.round(x0 + x1);
      let cy2 = Math.round(y0 + y1);
      if ((cx2 + cy2) % 2 !== 0) cy2 += 1; // keep the pivot on the lattice
      const sx = (cx2 + cy2) / 2,
        sy = (cy2 - cx2) / 2;
      rp = (p) => ({ x: sx - p.y, y: sy + p.x });
    } else {
      // everything is loose: turn inside its own bounding box, nudged to keep the middle in place
      const x0 = Math.min(...free.map((p) => p.x)),
        x1 = Math.max(...free.map((p) => p.x)),
        y0 = Math.min(...free.map((p) => p.y)),
        y1 = Math.max(...free.map((p) => p.y));
      const w = x1 - x0 + 1,
        h = y1 - y0 + 1,
        t = Math.trunc((w - h) / 2);
      rp = (p) => ({ x: x0 + h - 1 - (p.y - y0) + t, y: y0 + (p.x - x0) - t });
    }
    return {
      ...d,
      cables: d.cables.map((c) =>
        moving.includes(c)
          ? { ...c, a: mapFree(c.a, rp), b: mapFree(c.b, rp), waypoints: c.waypoints.map(rp) }
          : c,
      ),
    };
  }
  const b = boxOfAll(sel, moving),
    byId = new Map(sel.map((o) => [o.id, o]));
  const rc = (c: Cell): Cell => ({ x: b.x + b.h - 1 - (c.y - b.y), y: b.y + (c.x - b.x) });
  const inner = new Set(moving.map((c) => c.id));
  const ra = (a: Anchor, free: boolean): Anchor => {
    if (a.objId === undefined) return free ? mapFree(a, rc) : a;
    const o = byId.get(a.objId);
    return o ? { ...a, dx: o.h - 1 - a.dy, dy: a.dx } : a;
  };
  return {
    objects: d.objects.map((o) =>
      set.has(o.id)
        ? {
            ...o,
            x: b.x + b.h - (o.y - b.y) - o.h,
            y: b.y + (o.x - b.x),
            w: o.h,
            h: o.w,
            rot:
              isShaped(o.sub) || o.sub === 'straight' || o.sub === 'bridge' ? ((o.rot ?? 0) + 1) % 4 : o.rot,
          }
        : o,
    ),
    cables: d.cables.map((c) => {
      const free = inner.has(c.id);
      return {
        ...c,
        a: ra(c.a, free),
        b: ra(c.b, free),
        waypoints: free ? c.waypoints.map(rc) : c.waypoints,
      };
    }),
  };
}

/** Copies of objects (and the cables running between them), shifted by dx, dy, with fresh ids. */
export function cloneItems(objs: Obj[], cables: Cable[], dx: number, dy: number) {
  const map = new Map(objs.map((o) => [o.id, uid()]));
  const na = (a: Anchor): Anchor =>
    a.objId === undefined ? { x: a.x + dx, y: a.y + dy } : { ...a, objId: map.get(a.objId) ?? a.objId };
  return {
    objs: objs.map((o) => ({ ...o, id: map.get(o.id)!, x: o.x + dx, y: o.y + dy })),
    cables: cables.map((c) => ({
      ...c,
      id: uid(),
      a: na(c.a),
      b: na(c.b),
      waypoints: c.waypoints.map((p) => ({ x: p.x + dx, y: p.y + dy })),
    })),
  };
}
