import type { Doc, Obj, Sub } from './types';
import { ADDON_ORDER, CELL_MM, isMirrored, isTurn, labelOf, pieceOf } from './types';
import { racewayGeom } from './geometry';
import type { Route } from './route';

let ctx: CanvasRenderingContext2D | null | undefined;
const cache = new Map<string, Map<string, boolean>>();
/** Points (5 per cell side) the channel really covers, so curved pieces that only share a bounding box do not count as overlapping. */
function samples(o: Obj) {
  const key = [o.sub, o.x, o.y, o.w, o.h, o.rot ?? 0, o.flip ? 1 : 0].join();
  const hit = cache.get(key); if (hit) return hit;
  const out = new Map<string, boolean>(), S = 5;
  if (ctx === undefined) ctx = typeof document === 'undefined' ? null : document.createElement('canvas').getContext('2d');
  if (ctx) {
    const g = racewayGeom(o), path = new Path2D(g.d), m = g.m, len = Math.max(o.w, o.h);
    if (m) ctx.setTransform(S * m[0], S * m[1], S * m[2], S * m[3], S * m[4], S * m[5]); else ctx.setTransform(S, 0, 0, S, 0, 0);
    for (let j = 0; j < o.h * S; j++) for (let i = 0; i < o.w * S; i++) {
      const X = o.x * S + i, Y = o.y * S + j;
      if (!ctx.isPointInPath(path, X + 0.37, Y + 0.61)) continue;
      const idx = Math.floor((o.w >= o.h ? i : j) / S);
      out.set(`${X},${Y}`, o.sub === 'bridge' && idx > 0 && idx < len - 1); // true = passes over the ground
    }
  }
  if (cache.size > 600) cache.clear();
  cache.set(key, out); return out;
}

export function findOverlaps(doc: Doc): Set<string> {
  const s = new Set<string>(); const o = doc.objects;
  for (let i = 0; i < o.length; i++) for (let j = i + 1; j < o.length; j++) {
    const a = o[i], b = o[j];
    if (a.kind !== b.kind || !(a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h)) continue;
    let bad = true;
    if (a.kind === 'raceway') { // a bridge may span over another raceway
      const ca = samples(a), cb = samples(b); let shared = 0;
      for (const [k, aOver] of ca) { if (!cb.has(k)) continue; const bOver = cb.get(k)!; if (!((aOver && b.sub !== 'bridge') || (bOver && a.sub !== 'bridge'))) shared++; }
      bad = shared >= 3;
    }
    if (bad) { s.add(a.id); s.add(b.id); }
  }
  return s;
}

export function summarize(doc: Doc, routes: Map<string, Route>) {
  const map = new Map<string, { rows: number; cols: number; qty: number }>();
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity, tiles = 0, plates = 0;
  const am = new Map<string, { sub: Sub; len: number; label: string; spec: string; qty: number; order: number; mirrored: boolean }>();
  for (const o of doc.objects) {
    if ((o.kind === 'raceway' || o.kind === 'cover') && o.sub) {
      const len = Math.max(o.w, o.h), lin = o.sub === 'straight' || o.sub === 'bridge';
      const mir = isMirrored(o), key = o.sub + (lin || isTurn(o.sub) ? ':' + len : '') + (mir ? ':m' : '');
      const pc = pieceOf(o.sub, len);
      const spec = lin ? `${len} cells · ${len * CELL_MM} mm` : pc ? `${pc.w}×${pc.h} cells · ${pc.w * CELL_MM}×${pc.h * CELL_MM} mm` : `${CELL_MM} mm`;
      const e = am.get(key) ?? { sub: o.sub, len, label: labelOf(o.sub, mir), spec, qty: 0, order: ADDON_ORDER.indexOf(o.sub) * 1000 + len + (mir ? 0.5 : 0), mirrored: mir };
      e.qty++; am.set(key, e); continue;
    }
    if (o.kind !== 'plate') continue;
    const rows = Math.min(o.w, o.h), cols = Math.max(o.w, o.h), key = `${rows}×${cols}`;
    const e = map.get(key) ?? { rows, cols, qty: 0 }; e.qty++; map.set(key, e);
    tiles += o.w * o.h; plates++;
    minX = Math.min(minX, o.x); minY = Math.min(minY, o.y); maxX = Math.max(maxX, o.x + o.w); maxY = Math.max(maxY, o.y + o.h);
  }
  const pl = doc.objects.filter((o) => o.kind === 'plate');
  let connectors = 0;
  for (let i = 0; i < pl.length; i++) for (let j = i + 1; j < pl.length; j++) {
    const a = pl[i], b = pl[j];
    const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x), oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
    if ((a.x + a.w === b.x || b.x + b.w === a.x) && oy > 0) connectors += oy;
    else if ((a.y + a.h === b.y || b.y + b.h === a.y) && ox > 0) connectors += ox;
  }
  const sizes = [...map.values()].sort((a, b) => b.rows * b.cols - a.rows * a.cols || b.rows - a.rows);
  const addons = [...am.values()].sort((a, b) => a.order - b.order);
  const cables = doc.cables.map((c) => ({ id: c.id, name: c.name, color: c.color, mm: routes.get(c.id)?.mm ?? 0, bends: routes.get(c.id)?.bends ?? 0 }));
  return {
    sizes, plates, tiles, connectors, addons, addonCount: addons.reduce((s, a) => s + a.qty, 0),
    bboxMm: plates ? { w: (maxX - minX) * CELL_MM, h: (maxY - minY) * CELL_MM } : null,
    objects: doc.objects.filter((o) => o.kind === 'object').length,
    cables, cableMm: cables.reduce((s, c) => s + c.mm, 0),
  };
}

export function textColor(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const l = 0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255);
  return l > 150 ? '#1b1b1b' : '#ffffff';
}

export function summaryText(s: ReturnType<typeof summarize>) {
  return [
    'Bill of materials', '', 'openGrid tiles (rows×cols × qty):', ...s.sizes.map((z) => `  ${z.rows}×${z.cols} × ${z.qty}`),
    `  Total: ${s.plates} tiles, ${s.tiles} cells`, `  Connectors: ${s.connectors}`, '', 'Channels and tile covers:',
    ...(s.addons.length ? s.addons.map((a) => `  ${a.label} (${a.spec}) × ${a.qty}`) : ['  none']), '',
    `Objects: ${s.objects}`, `Cables: ${s.cables.length}, ${(s.cableMm / 1000).toFixed(2)} m total`, ...s.cables.map((c) => `  ${c.name}: ${c.mm} mm`),
  ].join('\n');
}
