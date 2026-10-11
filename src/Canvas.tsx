import { useEffect, useMemo, useRef, useState } from 'react';
import { blockFn, patchObject, stampFn, useStore } from './store';
import { boxOfAll, moveGroup } from './group';
import { anchorCell, computeRoutes, routeCells, simplify } from './route';
import type { Anchor, Cell, Doc, Obj, Sel } from './types';
import { ADDON_LABEL, MAX_TURN, isTurn, isVert, kindOf, layerOf, lenPatch, restoreD, stampDims } from './types';
import { matStr, portsList, racewayGeom } from './geometry';
import { findOverlaps, textColor } from './summary';
import { fitToContent, pointer, zoomAt } from './viewUtil';

type Drag =
  | { t: 'pan'; sx: number; sy: number; vx: number; vy: number; moved: boolean; bg: boolean }
  | { t: 'move'; ids: string[]; cids: string[]; fx: number; fy: number; base: Doc; moved: boolean; collapse?: Sel }
  | { t: 'marquee'; sx: number; sy: number; add: boolean; base: string[]; baseC: string[]; toggle?: Sel; moved: boolean }
  | { t: 'wp'; cableId: string; i: number }
  | { t: 'end'; cableId: string; end: 'a' | 'b' }
  | { t: 'resize'; id: string }
  | { t: 'paint'; last: string };

const INSET = 0.06; // channels are drawn this much narrower (cells) on each side
const R = 0.32; // corner radius (cells) for cable bends
/** Where a waypoint sits on the drawn cable: bends are rounded, so the handle goes to the middle of the curve instead of the sharp corner. */
function onCable(draw: Cell[], w: Cell) {
  const i = draw.findIndex((p, k) => k > 0 && k < draw.length - 1 && p.x === w.x && p.y === w.y);
  if (i < 0) return { x: w.x + 0.5, y: w.y + 0.5 };
  const p = draw[i - 1], c = draw[i], n = draw[i + 1];
  const r = Math.min(R, Math.hypot(c.x - p.x, c.y - p.y) / 2, Math.hypot(n.x - c.x, n.y - c.y) / 2);
  const u1 = { x: Math.sign(c.x - p.x), y: Math.sign(c.y - p.y) }, u2 = { x: Math.sign(n.x - c.x), y: Math.sign(n.y - c.y) };
  return { x: c.x + 0.5 + 0.25 * r * (u2.x - u1.x), y: c.y + 0.5 + 0.25 * r * (u2.y - u1.y) };
}
function pathD(pts: Cell[]) {
  const P = pts.map((p) => ({ x: p.x + 0.5, y: p.y + 0.5 }));
  if (P.length === 1) return `M${P[0].x} ${P[0].y}`;
  let d = `M${P[0].x} ${P[0].y}`;
  for (let i = 1; i < P.length - 1; i++) {
    const p = P[i - 1], c = P[i], n = P[i + 1];
    const r = Math.min(R, Math.hypot(c.x - p.x, c.y - p.y) / 2, Math.hypot(n.x - c.x, n.y - c.y) / 2);
    const u1 = { x: Math.sign(c.x - p.x), y: Math.sign(c.y - p.y) }, u2 = { x: Math.sign(n.x - c.x), y: Math.sign(n.y - c.y) };
    d += ` L${c.x - u1.x * r} ${c.y - u1.y * r} Q${c.x} ${c.y} ${c.x + u2.x * r} ${c.y + u2.y * r}`;
  }
  const l = P[P.length - 1];
  return d + ` L${l.x} ${l.y}`;
}

function objectAt(doc: Doc, c: Cell, hidden?: Record<string, boolean>): Obj | undefined {
  if (hidden?.objects) return undefined;
  for (let i = doc.objects.length - 1; i >= 0; i--) {
    const o = doc.objects[i];
    if (o.kind === 'object' && c.x >= o.x && c.x < o.x + o.w && c.y >= o.y && c.y < o.y + o.h) return o;
  }
}
function anchorFrom(doc: Doc, c: Cell, hidden?: Record<string, boolean>): Anchor {
  const o = objectAt(doc, c, hidden);
  return o ? { objId: o.id, dx: c.x - o.x, dy: c.y - o.y } : { x: c.x, y: c.y };
}
const sameAnchor = (a: Anchor, b: Anchor) => JSON.stringify(a) === JSON.stringify(b);

function wrap(name: string, max: number): string[] {
  const lines: string[] = []; let cur = '';
  for (const word of name.split(/\s+/).filter(Boolean)) {
    let wd = word;
    while (wd.length > max) { if (cur) { lines.push(cur); cur = ''; } lines.push(wd.slice(0, max)); wd = wd.slice(max); }
    if (!cur) cur = wd; else if ((cur + ' ' + wd).length <= max) cur += ' ' + wd; else { lines.push(cur); cur = wd; }
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [''];
}

const OCT = 'M.36 .2H.64L.8 .36V.64L.64 .8H.36L.2 .64V.36Z';
export function Canvas() {
  const { doc, sel, tool, view: v, stamp, block, wp, ids, cids, peek, hidden } = useStore();
  const svgRef = useRef<SVGSVGElement>(null);
  const routes = useMemo(() => computeRoutes(doc), [doc]);
  const routesRef = useRef(routes); routesRef.current = routes;
  const overlaps = useMemo(() => findOverlaps(doc), [doc]);
  const [hover, setHover] = useState<Cell | null>(null);
  const [pending, setPending] = useState<{ a: Anchor; wps: Cell[] } | null>(null);
  const [space, setSpace] = useState(false);
  const [marq, setMarq] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const drag = useRef<Drag | null>(null);
  const lastWp = useRef({ key: '', t: 0 });
  const lastObj = useRef({ id: '', t: 0 });
  const cancelEdit = useRef(false);
  const px = (n: number) => n / v.k;

  useEffect(() => { if (!useStore.getState().viewRestored) fitToContent(); }, []);
  useEffect(() => { if (tool !== 'cable') setPending(null); if (tool === 'select') setHover(null); }, [tool]);

  const finish = (end: Anchor, wps: Cell[]) => {
    if (!pending) return;
    const st = useStore.getState(); const byId = new Map(st.doc.objects.map((o) => [o.id, o]));
    const a0 = anchorCell(pending.a, byId), e0 = anchorCell(end, byId);
    if (!a0 || !e0 || (!wps.length && a0.x === e0.x && a0.y === e0.y)) return;
    st.addCable(pending.a, end, wps); setPending(null);
  };

  useEffect(() => {
    const el = svgRef.current!;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const st = useStore.getState(); const r = el.getBoundingClientRect();
      if (e.ctrlKey || e.metaKey) zoomAt(e.clientX - r.left, e.clientY - r.top, Math.exp(-Math.max(-40, Math.min(40, e.deltaY)) * 0.01));
      else st.setView({ ...st.view, x: st.view.x - e.deltaX, y: st.view.y - e.deltaY });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    const kd = (e: KeyboardEvent) => {
      if (/INPUT|TEXTAREA|SELECT/.test((e.target as HTMLElement).tagName)) return;
      if (e.code === 'Space') { setSpace(true); e.preventDefault(); }
      if (e.key === 'Escape') { setPending(null); const s0 = useStore.getState(); if (s0.tool === 'select') s0.select(null); else s0.setTool('select'); }
      if (e.key === 'Enter' && pending && hover) finish(anchorFrom(useStore.getState().doc, hover, useStore.getState().hidden), pending.wps);
    };
    const ku = (e: KeyboardEvent) => { if (e.code === 'Space') setSpace(false); };
    window.addEventListener('keydown', kd); window.addEventListener('keyup', ku);
    return () => { el.removeEventListener('wheel', onWheel); window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); };
  }, [pending, hover]);

  const toWorld = (cx: number, cy: number) => {
    const r = svgRef.current!.getBoundingClientRect(); const vv = useStore.getState().view;
    return { x: (cx - r.left - vv.x) / vv.k, y: (cy - r.top - vv.y) / vv.k };
  };
  const cellOf = (w: { x: number; y: number }): Cell => ({ x: Math.floor(w.x), y: Math.floor(w.y) });

  const cableClick = (cell: Cell) => {
    const st = useStore.getState(); const o = objectAt(st.doc, cell, st.hidden);
    if (!pending) { setPending({ a: anchorFrom(st.doc, cell, st.hidden), wps: [] }); return; }
    if (o) { finish(anchorFrom(st.doc, cell, st.hidden), pending.wps); return; }
    const byId = new Map(st.doc.objects.map((q) => [q.id, q]));
    const last = pending.wps[pending.wps.length - 1] ?? anchorCell(pending.a, byId);
    if (last && last.x === cell.x && last.y === cell.y) { // click the same empty cell again: stop the cable here
      if (pending.wps.length) finish({ x: cell.x, y: cell.y }, pending.wps.slice(0, -1));
      return;
    }
    setPending({ ...pending, wps: [...pending.wps, cell] });
  };

  const onDown = (e: React.PointerEvent) => {
    const st = useStore.getState(); const w = toWorld(e.clientX, e.clientY); const cell = cellOf(w);
    const el = (e.target as Element).closest('[data-k]') as SVGElement | null;
    const kind = el?.getAttribute('data-k'); const id = el?.getAttribute('data-id') ?? '';
    svgRef.current!.setPointerCapture(e.pointerId);
    const pan = (bg: boolean) => { drag.current = { t: 'pan', sx: e.clientX, sy: e.clientY, vx: st.view.x, vy: st.view.y, moved: false, bg }; };
    if (e.button === 1 || (e.button === 0 && space)) { e.preventDefault(); pan(false); return; }
    if (e.button !== 0) return;
    if (st.tool === 'pan') { pan(false); return; }
    if (st.tool === 'cable') { cableClick(cell); return; }
    if (st.tool === 'place') {
      if (st.block) { st.begin(); st.live(blockFn(st.block, cell)); drag.current = { t: 'paint', last: '' }; return; }
      if (!st.stamp) return;
      st.begin(); st.live(stampFn(st.stamp, cell)); drag.current = { t: 'paint', last: `${cell.x},${cell.y}` }; return;
    }
    if (kind === 'wp') {
      const i = +el!.getAttribute('data-i')!; const key = `${id}:${i}`; const now = Date.now();
      if (lastWp.current.key === key && now - lastWp.current.t < 400) { // double-click deletes the point
        st.setWp(i); st.removeSel(); lastWp.current = { key: '', t: 0 }; return;
      }
      lastWp.current = { key, t: now }; st.setWp(i); st.begin(); drag.current = { t: 'wp', cableId: id, i }; return;
    }
    if (kind === 'end') { st.begin(); drag.current = { t: 'end', cableId: id, end: el!.getAttribute('data-end') as 'a' | 'b' }; return; }
    if (kind === 'resize') { st.begin(); drag.current = { t: 'resize', id }; return; }
    if (kind === 'cable') {
      if (e.shiftKey || e.metaKey || e.ctrlKey) { drag.current = { t: 'marquee', sx: w.x, sy: w.y, add: true, base: st.ids, baseC: st.cids, toggle: { type: 'cable', id }, moved: false }; return; }
      if (st.ids.length + st.cids.length > 1 && st.cids.includes(id)) { // part of a group: drag moves everything
        st.begin(); drag.current = { t: 'move', ids: st.ids, cids: st.cids, fx: w.x, fy: w.y, base: st.doc, moved: false, collapse: { type: 'cable', id } }; return;
      }
      if (!(st.sel?.type === 'cable' && st.sel.id === id && st.ids.length + st.cids.length < 2)) { st.select({ type: 'cable', id }); return; }
      const rt = routesRef.current.get(id); if (!rt) return;
      let idx = 0, best = Infinity;
      rt.segs.forEach((s, i) => s.forEach((p) => { const dd = Math.abs(p.x - cell.x) + Math.abs(p.y - cell.y); if (dd < best) { best = dd; idx = i; } }));
      st.begin();
      st.live((d) => ({ ...d, cables: d.cables.map((c) => (c.id === id ? { ...c, waypoints: [...c.waypoints.slice(0, idx), cell, ...c.waypoints.slice(idx)] } : c)) }));
      st.setWp(idx); drag.current = { t: 'wp', cableId: id, i: idx }; return;
    }
    if (kind === 'obj') {
      const o = st.doc.objects.find((q) => q.id === id); if (!o) return;
      if (e.shiftKey || e.metaKey || e.ctrlKey) { // shift-click toggles, shift-drag sweeps a box that adds to the selection
        drag.current = { t: 'marquee', sx: w.x, sy: w.y, add: true, base: st.ids, baseC: st.cids, toggle: { type: 'obj', id }, moved: false }; return;
      }
      const group = st.ids.length + st.cids.length > 1 && st.ids.includes(id);
      if (!group) st.select({ type: 'obj', id });
      const now = Date.now();
      if ((o.kind === 'object' || o.kind === 'plate') && lastObj.current.id === id && now - lastObj.current.t < 400) { // double-click renames
        lastObj.current = { id: '', t: 0 }; e.preventDefault(); setEditing(id); return;
      }
      lastObj.current = { id, t: now };
      st.begin(); drag.current = { t: 'move', ids: group ? st.ids : [id], cids: group ? st.cids : [], fx: w.x, fy: w.y, base: st.doc, moved: false, collapse: group ? { type: 'obj', id } : undefined }; return;
    }
    drag.current = { t: 'marquee', sx: w.x, sy: w.y, add: e.shiftKey, base: e.shiftKey ? st.ids : [], baseC: e.shiftKey ? st.cids : [], moved: false };
  };

  const onMove = (e: React.PointerEvent) => {
    const st = useStore.getState(); const w = toWorld(e.clientX, e.clientY); const cell = cellOf(w);
    pointer.cell = cell;
    if (st.tool !== 'select') setHover((h) => (h && h.x === cell.x && h.y === cell.y ? h : cell));
    const d = drag.current; if (!d) return;
    if (d.t === 'pan') {
      const dx = e.clientX - d.sx, dy = e.clientY - d.sy;
      if (Math.abs(dx) + Math.abs(dy) > 3) d.moved = true;
      st.setView({ ...st.view, x: d.vx + dx, y: d.vy + dy });
    } else if (d.t === 'move') {
      const dx = Math.round(w.x - d.fx), dy = Math.round(w.y - d.fy);
      if (dx || dy) d.moved = true;
      st.live(() => moveGroup(d.base, d.ids, d.cids, dx, dy));
    } else if (d.t === 'marquee') {
      if (!d.moved && Math.hypot(w.x - d.sx, w.y - d.sy) * st.view.k < 4) return;
      d.moved = true;
      const x0 = Math.min(w.x, d.sx), x1 = Math.max(w.x, d.sx), y0 = Math.min(w.y, d.sy), y1 = Math.max(w.y, d.sy);
      setMarq({ x0, y0, x1, y1 });
      const hit = st.doc.objects.filter((o) => !st.hidden[layerOf(o)] && o.x < x1 && o.x + o.w > x0 && o.y < y1 && o.y + o.h > y0).map((o) => o.id);
      const hitC = st.hidden.cables ? [] : st.doc.cables.filter((c) => { const r = routesRef.current.get(c.id); if (!r) return false;
        const P = r.draw.map((p) => ({ x: p.x + 0.5, y: p.y + 0.5 }));
        return P.some((p, i) => { const q = P[i + 1] ?? p; return Math.max(p.x, q.x) >= x0 && Math.min(p.x, q.x) <= x1 && Math.max(p.y, q.y) >= y0 && Math.min(p.y, q.y) <= y1; }); }).map((c) => c.id);
      st.selectIds(d.add ? [...new Set([...d.base, ...hit])] : hit, d.add ? [...new Set([...d.baseC, ...hitC])] : hitC);
    } else if (d.t === 'wp') {
      st.live((doc) => ({ ...doc, cables: doc.cables.map((c) => {
        if (c.id !== d.cableId) return c; const cur = c.waypoints[d.i];
        if (!cur || (cur.x === cell.x && cur.y === cell.y)) return c;
        return { ...c, waypoints: c.waypoints.map((q, j) => (j === d.i ? cell : q)) };
      }) }));
    } else if (d.t === 'end') {
      st.live((doc) => ({ ...doc, cables: doc.cables.map((c) => {
        if (c.id !== d.cableId) return c; const na = anchorFrom(doc, cell, st.hidden);
        return sameAnchor(c[d.end], na) ? c : { ...c, [d.end]: na };
      }) }));
    } else if (d.t === 'resize') {
      st.live((doc) => {
        const o = doc.objects.find((q) => q.id === d.id); if (!o) return doc;
        if (o.sub === 'straight' || o.sub === 'bridge') {
          const min = o.sub === 'bridge' ? 3 : 1;
          return patchObject(doc, d.id, lenPatch(o, Math.max(min, isVert(o) ? cell.y - o.y + 1 : cell.x - o.x + 1)));
        }
        if (isTurn(o.sub)) { const n = Math.max(1, Math.min(MAX_TURN, Math.max(cell.x - o.x + 1, cell.y - o.y + 1))); return patchObject(doc, d.id, { w: n, h: n }); }
        return patchObject(doc, d.id, { w: Math.max(1, cell.x - o.x + 1), h: Math.max(1, cell.y - o.y + 1) });
      });
    } else if (d.t === 'paint') {
      const key = `${cell.x},${cell.y}`; const s = st.stamp;
      if (key !== d.last && s) { const { w: sw, h: sh } = stampDims(s); if (sw === 1 && sh === 1) { d.last = key; st.live(stampFn(s, cell)); } }
    }
  };

  const onUp = (e: React.PointerEvent) => {
    const d = drag.current; drag.current = null;
    try { svgRef.current!.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
    if (!d) return;
    const s = useStore.getState();
    if (d.t === 'pan') { if (d.bg && !d.moved) s.select(null); }
    else if (d.t === 'marquee') {
      setMarq(null);
      if (!d.moved) { if (d.toggle) (d.toggle.type === 'obj' ? s.toggleId(d.toggle.id) : s.toggleCable(d.toggle.id)); else if (!d.add) s.select(null); }
    } else {
      if (d.t === 'move' && !d.moved && d.collapse) s.select(d.collapse);
      s.end();
    }
  };

  const onContext = (e: React.MouseEvent) => {
    e.preventDefault();
    const st = useStore.getState();
    if (st.tool === 'place') { st.setTool('select'); return; }
    if (pending) { setPending(pending.wps.length ? { ...pending, wps: pending.wps.slice(0, -1) } : null); return; }
    const el = (e.target as Element).closest('[data-k="wp"]');
    if (el) { st.select({ type: 'cable', id: el.getAttribute('data-id')! }); st.setWp(+el.getAttribute('data-i')!); st.removeSel(); }
  };

  const preview = useMemo(() => {
    if (!pending || !hover) return null;
    const byId = new Map(doc.objects.map((o) => [o.id, o]));
    const a0 = anchorCell(pending.a, byId); if (!a0) return null;
    const ho = objectAt(doc, hover, hidden);
    const pts = [a0, ...pending.wps, hover];
    const obst = doc.objects.filter((o) => o.kind === 'object' && o.id !== pending.a.objId && o.id !== ho?.id);
    const all: Cell[] = [];
    for (let i = 0; i < pts.length - 1; i++) for (const p of routeCells(pts[i], pts[i + 1], obst)) { const l = all[all.length - 1]; if (!l || l.x !== p.x || l.y !== p.y) all.push(p); }
    return simplify(all);
  }, [pending, hover, doc]);

  const multi = ids.length + cids.length > 1;
  const selObjs = doc.objects.filter((o) => ids.includes(o.id));
  const selCables = doc.cables.filter((c) => cids.includes(c.id));
  const selObj = !multi && sel?.type === 'obj' ? doc.objects.find((o) => o.id === sel.id) : undefined;
  const selCable = !multi && sel?.type === 'cable' ? doc.cables.find((c) => c.id === sel.id) : undefined;
  const cableW = Math.max(0.16, 3 / v.k);
  const showLabels = v.k >= 14;
  const hoverObj = hover && tool === 'cable' ? objectAt(doc, hover, hidden) : undefined;
  const cursor = space || tool === 'pan' || drag.current?.t === 'pan' ? 'grab' : tool === 'select' ? 'default' : 'crosshair';
  const noPtr = { pointerEvents: 'none', userSelect: 'none' } as const;

  const renderObj = (o: Obj, ghost = false) => {
    const over = overlaps.has(o.id);
    const props = ghost ? { opacity: 0.65, pointerEvents: 'none' as const } : { 'data-k': 'obj', 'data-id': o.id };
    if (o.kind === 'plate') return (
      <g key={o.id} {...props}>
        <mask id={`pm-${o.id}`} maskUnits="userSpaceOnUse" x={o.x} y={o.y} width={o.w} height={o.h}>
          <rect x={o.x} y={o.y} width={o.w} height={o.h} fill="#fff" />
          <rect x={o.x} y={o.y} width={o.w} height={o.h} fill="url(#og-holes)" />
        </mask>
        <g mask={`url(#pm-${o.id})`}>
          <rect x={o.x} y={o.y} width={o.w} height={o.h} rx={0.12} fill={o.color} />
          <rect x={o.x} y={o.y} width={o.w} height={o.h} fill="url(#og-cell)" />
        </g>
        <rect x={o.x} y={o.y} width={o.w} height={o.h} fill="url(#og-rim)" />
        <rect x={o.x} y={o.y} width={o.w} height={o.h} rx={0.12} fill="none" stroke={over ? 'var(--danger)' : 'rgba(0,0,0,.4)'} strokeWidth={over ? 2.5 : 1.25} strokeDasharray={over ? '6 4' : undefined} vectorEffect="non-scaling-stroke" />
        {showLabels && editing !== o.id && <text x={o.x + 0.12} y={o.y + 0.3} fontSize={0.24} fill="rgba(0,0,0,.6)" style={noPtr}>{o.name} {o.h}×{o.w}</text>}
      </g>
    );
    if (o.kind === 'cover') return (
      <g key={o.id} transform={`translate(${o.x} ${o.y})`} {...props}>
        <path d={OCT} transform="translate(.5 .5) scale(1.14) translate(-.5 -.5)" fill={o.color} stroke={over ? 'var(--danger)' : 'rgba(0,0,0,.55)'} strokeWidth={1} vectorEffect="non-scaling-stroke" />
        {o.sub === 'wall' && <circle cx={0.5} cy={0.5} r={0.085} fill="var(--canvas)" stroke="rgba(0,0,0,.65)" strokeWidth={1} vectorEffect="non-scaling-stroke" />}
      </g>
    );
    if (o.kind === 'raceway') {
      const g = racewayGeom(o), d = g.d, tf = g.m ? matStr(g.m) : undefined, len = Math.max(o.w, o.h), horiz = !isVert(o);
      return (
        <g key={o.id} {...props}>
          {o.sub === 'bridge' && <path d={racewayGeom({ ...o, x: o.x + 0.05, y: o.y + 0.07 }).d} fill="rgba(0,0,0,.28)" />}
          {(() => { // the body is drawn slightly narrower than its cells so it never runs edge to edge; the open ends stay flush
            const pl = portsList(o), bw = (over ? 3 : 1.6) / v.k;
            const mk = (id: string, inset: number) => (
              <mask id={id} maskUnits="userSpaceOnUse" x={o.x - 1} y={o.y - 1} width={o.w + 2} height={o.h + 2}>
                <rect x={o.x - 1} y={o.y - 1} width={o.w + 2} height={o.h + 2} fill="#fff" />
                <path d={d} transform={tf} fill="none" stroke="#000" strokeWidth={inset * 2} strokeLinejoin="miter" />
                {pl.ports.length > 0 && <path d={restoreD(pl.ports, inset * 2 + 0.02, 0.5 - inset)} transform={pl.m ? matStr(pl.m) : undefined} fill="#fff" />}
              </mask>);
            return <>
              <defs>{mk(`cm1-${o.id}`, INSET)}{mk(`cm2-${o.id}`, INSET + bw)}</defs>
              <g mask={`url(#cm1-${o.id})`}><path d={d} transform={tf} fill={over ? 'var(--danger)' : 'rgba(0,0,0,.6)'} /></g>
              <g mask={`url(#cm2-${o.id})`}><path d={d} transform={tf} fill={o.color} /></g>
            </>; })()}
          {g.sep && <path d={g.sep} transform={tf} fill="none" stroke="rgba(0,0,0,.6)" strokeWidth={2} strokeLinecap="round" vectorEffect="non-scaling-stroke" />}
          {o.sub === 'bridge' && len >= 3 && (horiz
            ? <rect x={o.x + 1} y={o.y + 0.1} width={len - 2} height={0.8} fill="rgba(255,255,255,.3)" stroke="rgba(0,0,0,.5)" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
            : <rect x={o.x + 0.1} y={o.y + 1} width={0.8} height={len - 2} fill="rgba(255,255,255,.3)" stroke="rgba(0,0,0,.5)" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />)}
        </g>
      );
    }
    const tc = textColor(o.color), max = Math.max(3, Math.floor((o.w - 0.2) * 5.2)), lh = 0.34;
    let lines = wrap(o.name, max); const cap = Math.max(1, Math.floor((o.h - 0.1) / lh));
    if (lines.length > cap) { lines = lines.slice(0, cap); lines[cap - 1] = lines[cap - 1].slice(0, -1) + '…'; }
    const showSize = lines.length * lh + 0.28 <= o.h - 0.1, total = lines.length * lh + (showSize ? 0.28 : 0), y0 = o.y + o.h / 2 - total / 2;
    return (
      <g key={o.id} {...props}>
        <rect x={o.x + 0.05} y={o.y + 0.05} width={o.w - 0.1} height={o.h - 0.1} rx={0.14} fill={o.color} stroke={over ? 'var(--danger)' : 'rgba(0,0,0,.45)'} strokeWidth={over ? 2.5 : 1.25} vectorEffect="non-scaling-stroke" />
        {showLabels && editing !== o.id && <>
          {lines.map((ln, i) => <text key={i} x={o.x + o.w / 2} y={y0 + (i + 0.5) * lh} textAnchor="middle" dominantBaseline="central" fontSize={0.3} fontWeight={600} fill={tc} style={noPtr}>{ln}</text>)}
          {showSize && <text x={o.x + o.w / 2} y={y0 + lines.length * lh + 0.14} textAnchor="middle" dominantBaseline="central" fontSize={0.2} fill={tc} opacity={0.75} style={noPtr}>{o.w}×{o.h}</text>}
        </>}
      </g>
    );
  };

  const raceways = doc.objects.filter((o) => o.kind === 'raceway');
  const ghost: Obj | null = tool === 'place' && block && hover
    ? { id: 'ghost', kind: block.kind, name: block.name, x: hover.x - Math.floor(block.w / 2), y: hover.y - Math.floor(block.h / 2), w: block.w, h: block.h, color: block.color }
    : tool === 'place' && stamp && hover
    ? { id: 'ghost', kind: kindOf(stamp.sub), sub: stamp.sub, name: ADDON_LABEL[stamp.sub], x: hover.x, y: hover.y, ...stampDims(stamp), color: stamp.color, rot: stamp.rot, flip: stamp.flip } : null;
  const eo = editing ? doc.objects.find((o) => o.id === editing) : undefined;
  const commitName = (val: string) => {
    if (!eo) { setEditing(null); return; }
    const n = val.trim();
    if (!cancelEdit.current && n && n !== eo.name) useStore.getState().commit((d) => patchObject(d, eo.id, { name: n }));
    cancelEdit.current = false; setEditing(null);
  };
  const canResize = selObj && (selObj.kind === 'plate' || selObj.kind === 'object' || selObj.sub === 'straight' || selObj.sub === 'bridge' || isTurn(selObj.sub));

  return (<>
    <svg ref={svgRef} className="canvas" style={{ cursor }} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={() => { pointer.cell = null; }} onContextMenu={onContext}>
      <defs>
        <pattern id="g-minor" width={1} height={1} patternUnits="userSpaceOnUse" patternTransform={`translate(${v.x} ${v.y}) scale(${v.k})`}>
          <path d="M0 0H1M0 0V1" fill="none" stroke="var(--grid-minor)" strokeWidth={2 / v.k} />
        </pattern>
        <pattern id="g-major" width={5} height={5} patternUnits="userSpaceOnUse" patternTransform={`translate(${v.x} ${v.y}) scale(${v.k})`}>
          <path d="M0 0H5M0 0V5" fill="none" stroke="var(--grid-major)" strokeWidth={2.5 / v.k} />
        </pattern>
        <pattern id="og-cell" width={1} height={1} patternUnits="userSpaceOnUse">
          <rect x={0.03} y={0.03} width={0.94} height={0.94} rx={0.1} fill="none" stroke="rgba(0,0,0,.28)" strokeWidth={0.03} />
        </pattern>
        <pattern id="og-holes" width={1} height={1} patternUnits="userSpaceOnUse"><path d={OCT} fill="#000" /></pattern>
        <pattern id="og-rim" width={1} height={1} patternUnits="userSpaceOnUse"><path d={OCT} fill="none" stroke="rgba(0,0,0,.4)" strokeWidth={0.035} /></pattern>
      </defs>
      <rect width="100%" height="100%" fill="var(--canvas)" />
      <rect width="100%" height="100%" fill="url(#g-minor)" opacity={v.k >= 9 ? 1 : 0} />
      <rect width="100%" height="100%" fill="url(#g-major)" opacity={v.k >= 3 ? 1 : 0} />
      <g transform={`translate(${v.x} ${v.y}) scale(${v.k})`}>
        {!hidden.tiles && doc.objects.filter((o) => o.kind === 'plate').map((o) => renderObj(o))}
        {!hidden.tiles && doc.objects.filter((o) => o.kind === 'cover').map((o) => renderObj(o))}
        {!hidden.objects && doc.objects.filter((o) => o.kind === 'object').map((o) => renderObj(o))}

        {!hidden.cables && doc.cables.map((c) => {
          const r = routes.get(c.id); if (!r) return null; const d = r.d || pathD(r.draw); const s = cids.includes(c.id);
          const ends = [{ p: r.pts[0], free: c.a.objId === undefined }, { p: r.pts[r.pts.length - 1], free: c.b.objId === undefined }];
          return (
            <g key={c.id}>
              {s && <path d={d} fill="none" stroke="var(--accent)" strokeWidth={cableW + px(8)} strokeLinecap="round" opacity={0.35} pointerEvents="none" />}
              <path d={d} fill="none" stroke="var(--canvas)" strokeWidth={cableW + px(3)} strokeLinecap="round" strokeLinejoin="round" opacity={0.9} pointerEvents="none" />
              <path d={d} fill="none" stroke={c.color} strokeWidth={cableW} strokeLinecap="round" strokeLinejoin="round" pointerEvents="none" />
              {ends.map((e, i) => <circle key={i} cx={e.p.x + 0.5} cy={e.p.y + 0.5} r={cableW * 0.95} fill={e.free ? '#fff' : c.color} stroke={e.free ? c.color : '#fff'} strokeWidth={e.free ? 2.5 : 1.5} vectorEffect="non-scaling-stroke" pointerEvents="none" />)}
              {tool === 'select' && <path data-k="cable" data-id={c.id} d={d} fill="none" stroke="transparent" strokeWidth={Math.max(0.4, px(10))} strokeLinecap="round" style={{ pointerEvents: 'stroke', cursor: 'pointer' }} />}
            </g>
          );
        })}

        {/* raceways sit above cables and hide them */}
        <g opacity={peek ? 0.75 : 1} display={hidden.channels ? 'none' : undefined}>
          {raceways.filter((o) => o.sub !== 'bridge').map((o) => renderObj(o))}
          {raceways.filter((o) => o.sub === 'bridge').map((o) => renderObj(o))}
        </g>
        {selCable && routes.get(selCable.id) && <path d={routes.get(selCable.id)!.d || pathD(routes.get(selCable.id)!.draw)} fill="none" stroke="var(--accent)" strokeWidth={2} strokeDasharray="5 4" vectorEffect="non-scaling-stroke" strokeLinecap="round" pointerEvents="none" />}
        {multi && <g pointerEvents="none">
          {selObjs.map((o) => <rect key={o.id} x={o.x} y={o.y} width={o.w} height={o.h} fill="none" stroke="var(--accent)" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />)}
          {(() => { const b = boxOfAll(selObjs, selCables); return <rect x={b.x - 0.08} y={b.y - 0.08} width={b.w + 0.16} height={b.h + 0.16} fill="none" stroke="var(--accent)" strokeWidth={1.5} strokeDasharray="6 4" vectorEffect="non-scaling-stroke" />; })()}
        </g>}
        {selObj && <g>
          <rect x={selObj.x} y={selObj.y} width={selObj.w} height={selObj.h} fill="none" stroke="var(--accent)" strokeWidth={2} vectorEffect="non-scaling-stroke" pointerEvents="none" />
          {canResize && <rect data-k="resize" data-id={selObj.id} x={selObj.x + selObj.w - px(6)} y={selObj.y + selObj.h - px(6)} width={px(12)} height={px(12)} fill="#fff" stroke="var(--accent)" strokeWidth={1.5} vectorEffect="non-scaling-stroke" style={{ cursor: 'nwse-resize' }} />}
        </g>}

        {selCable && tool === 'select' && (() => {
          const r = routes.get(selCable.id); if (!r) return null;
          const ends = [r.pts[0], r.pts[r.pts.length - 1]];
          return <>
            {selCable.waypoints.map((w, i) => (
              <circle key={i} data-k="wp" data-id={selCable.id} data-i={i} cx={onCable(r.draw, w).x} cy={onCable(r.draw, w).y} r={px(wp === i ? 7 : 6)} fill={wp === i ? 'var(--accent)' : '#fff'} stroke="var(--accent)" strokeWidth={2} vectorEffect="non-scaling-stroke" style={{ cursor: 'move' }} />
            ))}
            {ends.map((p, i) => <rect key={i} data-k="end" data-id={selCable.id} data-end={i === 0 ? 'a' : 'b'} x={p.x + 0.5 - px(7)} y={p.y + 0.5 - px(7)} width={px(14)} height={px(14)} rx={px(3)} fill="#fff" stroke="var(--accent)" strokeWidth={2} vectorEffect="non-scaling-stroke" style={{ cursor: 'grab' }} />)}
          </>;
        })()}

        {ghost && renderObj(ghost, true)}
        {marq && <rect x={marq.x0} y={marq.y0} width={marq.x1 - marq.x0} height={marq.y1 - marq.y0} fill="var(--accent)" fillOpacity={0.1} stroke="var(--accent)" strokeWidth={1} vectorEffect="non-scaling-stroke" pointerEvents="none" />}
        {tool === 'cable' && hover && (
          <rect x={hover.x} y={hover.y} width={1} height={1} rx={0.1} fill={hoverObj ? 'var(--accent)' : 'transparent'} fillOpacity={0.22} stroke="var(--accent)" strokeWidth={1.5} strokeDasharray={hoverObj ? undefined : '4 3'} vectorEffect="non-scaling-stroke" pointerEvents="none" />
        )}
        {pending && preview && <path d={pathD(preview)} fill="none" stroke="var(--accent)" strokeWidth={cableW} strokeDasharray={`${cableW * 2} ${cableW * 1.5}`} strokeLinecap="round" pointerEvents="none" />}
        {pending && pending.wps.map((w, i) => <circle key={i} cx={w.x + 0.5} cy={w.y + 0.5} r={px(5)} fill="var(--accent)" pointerEvents="none" />)}
      </g>
    </svg>
    {eo && (
      <input className="rename" autoFocus defaultValue={eo.name} aria-label="Rename"
        style={eo.kind === 'plate'
          ? { left: v.x + eo.x * v.k + 4, top: v.y + eo.y * v.k + 4, width: Math.max(120, Math.min(eo.w * v.k - 8, 240)) }
          : { left: v.x + eo.x * v.k + 4, top: v.y + (eo.y + eo.h / 2) * v.k - 14, width: Math.max(100, eo.w * v.k - 8) }}
        onFocus={(e) => e.currentTarget.select()} onBlur={(e) => commitName(e.currentTarget.value)}
        onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') { cancelEdit.current = true; e.currentTarget.blur(); } }} />
    )}
  </>);
}
