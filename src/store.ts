import { create } from 'zustand';
import type { Anchor, Block, Cable, Cell, Doc, Layer, Obj, Sel, Stamp, Sub, Tool, View } from './types';
import { boxOfAll, carried, cloneItems, moveGroup, rotateGroup, uid } from './group';
import {
  ADDON_DEFAULT,
  ADDON_LABEL,
  COLORS,
  counterpart,
  PIECES,
  PLATE_DEFAULT,
  isShaped,
  isTurn,
  kindOf,
  layerOf,
  stampDims,
} from './types';

const KEY = 'underware-planner-v1';
export { uid };
const clampAnchor = (a: Anchor, o: Obj): Anchor =>
  a.objId === undefined
    ? a
    : { ...a, dx: Math.max(0, Math.min(o.w - 1, a.dx)), dy: Math.max(0, Math.min(o.h - 1, a.dy)) };

export function patchObject(d: Doc, id: string, p: Partial<Obj>): Doc {
  const old = d.objects.find((o) => o.id === id);
  if (!old) return d;
  const n: Obj = { ...old, ...p };
  if (p.w !== undefined) n.w = Math.max(1, Math.round(n.w));
  if (p.h !== undefined) n.h = Math.max(1, Math.round(n.h));
  if (n.x !== old.x) n.x = Math.round(n.x);
  if (n.y !== old.y) n.y = Math.round(n.y);
  if (Object.keys(n).every((k) => (n as any)[k] === (old as any)[k])) return d;
  const cables =
    n.w !== old.w || n.h !== old.h
      ? d.cables.map((c) => ({
          ...c,
          a: c.a.objId === id ? clampAnchor(c.a, n) : c.a,
          b: c.b.objId === id ? clampAnchor(c.b, n) : c.b,
        }))
      : d.cables;
  return { objects: d.objects.map((o) => (o.id === id ? n : o)), cables };
}
export function removeObject(d: Doc, id: string): Doc {
  const o = d.objects.find((q) => q.id === id);
  const free = (a: Anchor): Anchor => (a.objId === id && o ? { x: o.x + a.dx, y: o.y + a.dy } : a); // cable ends stay put as free ends
  return {
    objects: d.objects.filter((q) => q.id !== id),
    cables: d.cables.map((c) => ({ ...c, a: free(c.a), b: free(c.b) })),
  };
}
export const patchCable = (d: Doc, id: string, p: Partial<Cable>): Doc => ({
  ...d,
  cables: d.cables.map((c) => (c.id === id ? { ...c, ...p } : c)),
});

export function makeAddon(
  sub: Sub,
  x: number,
  y: number,
  len = 3,
  rot = 0,
  flip = false,
  color = ADDON_DEFAULT,
): Obj {
  const { w, h } = stampDims({ sub, len, rot });
  return { id: uid(), kind: kindOf(sub), sub, name: ADDON_LABEL[sub], x, y, w, h, color, rot: rot % 4, flip };
}
export function stampFn(st: Stamp, cell: Cell) {
  return (d: Doc): Doc => {
    const o = makeAddon(st.sub, cell.x, cell.y, st.len, st.rot, st.flip, st.color);
    if (o.kind === 'cover') {
      // one cover per hole: replace what is there
      const ex = d.objects.find((q) => q.kind === 'cover' && q.x === cell.x && q.y === cell.y);
      if (ex)
        return ex.sub === st.sub && ex.color === st.color
          ? d
          : {
              ...d,
              objects: d.objects.map((q) =>
                q === ex ? { ...ex, sub: st.sub, name: o.name, color: st.color } : q,
              ),
            };
    }
    return { ...d, objects: [...d.objects, o] };
  };
}
export const blockFn =
  (b: Block, cell: Cell) =>
  (d: Doc): Doc => {
    const o: Obj = {
      id: uid(),
      kind: b.kind,
      name: b.name,
      x: cell.x - Math.floor(b.w / 2),
      y: cell.y - Math.floor(b.h / 2),
      w: b.w,
      h: b.h,
      color: b.color,
    };
    return { ...d, objects: [...d.objects, o] };
  };
// older saves stored 1x1 turn / junction pieces; resize them to the catalogue footprint
function migrate(doc: Doc): Doc {
  return {
    ...doc,
    objects: doc.objects.map((o) => {
      const sub = o.sub as string | undefined;
      if (o.kind === 'plate') return o.name === 'Plate' ? { ...o, name: 'Tile' } : o;
      if (o.kind === 'cover') return o.name === 'Hole cover' ? { ...o, name: ADDON_LABEL.hole } : o;
      if (o.kind !== 'raceway' || !sub) return o;
      if (sub === 'turn2' || sub === 'turn3') {
        const n = sub === 'turn2' ? 3 : 4;
        return { ...o, sub: 'turn', w: n, h: n, name: ADDON_LABEL.turn };
      } // earlier fixed-size turns
      if (isTurn(o.sub)) {
        const n = Math.max(o.w, o.h);
        return o.w === n && o.h === n ? o : { ...o, w: n, h: n };
      }
      if (sub === 'branch_round' || sub === 'branch_angled') {
        const ns = sub === 'branch_round' ? 'y_round' : 'y_angled';
        return {
          ...o,
          sub: ns,
          rot: ((o.rot ?? 0) + 2) % 4,
          name:
            o.name === 'Channel, branch (rounded)' || o.name === 'Channel, branch (angled)'
              ? ADDON_LABEL[ns]
              : o.name,
        };
      } // a branch is a merge turned half way round
      if (sub === 'jog_round_s' || sub === 'jog_angled_s') {
        const ns = sub === 'jog_round_s' ? 'jog_round' : 'jog_angled';
        return { ...o, sub: ns, flip: !o.flip, name: ADDON_LABEL[ns] };
      } // the tight offsets were just the mirrored parts
      if (!PIECES[o.sub!]) return o;
      const { w, h } = stampDims({ sub: o.sub!, len: 1, rot: o.rot ?? 0 });
      return o.w === w && o.h === h ? o : { ...o, w, h, name: ADDON_LABEL[o.sub!] };
    }),
  };
}

/** Ids of objects/cables in `to` that were added or changed relative to `from` (what an undo/redo touched). */
function changedIn(from: Doc, to: Doc, hidden?: Record<Layer, boolean>) {
  const diff = <T extends { id: string }>(a: T[], b: T[]) => {
    const m = new Map(a.map((x) => [x.id, x]));
    return b.filter((x) => {
      const y = m.get(x.id);
      return !y || (y !== x && JSON.stringify(y) !== JSON.stringify(x));
    });
  };
  const ids = diff(from.objects, to.objects)
      .filter((o) => !hidden?.[layerOf(o)])
      .map((o) => o.id),
    cids = hidden?.cables ? [] : diff(from.cables, to.cables).map((c) => c.id);
  return {
    ids,
    cids,
    sel: ids.length
      ? { type: 'obj' as const, id: ids[0] }
      : cids.length
        ? { type: 'cable' as const, id: cids[0] }
        : null,
    wp: null,
  };
}
const plate = (x: number, y: number, rows: number, cols: number): Obj => ({
  id: uid(),
  kind: 'plate',
  name: 'Tile',
  x,
  y,
  w: cols,
  h: rows,
  color: PLATE_DEFAULT,
});
const obj = (name: string, x: number, y: number, w: number, h: number, color: string): Obj => ({
  id: uid(),
  kind: 'object',
  name,
  x,
  y,
  w,
  h,
  color,
});
function seed(): Doc {
  const p1 = plate(0, 0, 4, 8),
    p2 = plate(9, 0, 4, 2),
    p3 = plate(0, 5, 2, 4);
  const router = obj('Router', 1, 1, 2, 1, '#4361ee'),
    sw = obj('Switch', 5, 1, 2, 1, '#2a9d8f'),
    nas = obj('NAS', 4, 2, 1, 2, '#343a40');
  const cables: Cable[] = [
    {
      id: uid(),
      name: 'Cable 1',
      color: '#e76f51',
      a: { objId: router.id, dx: 1, dy: 0 },
      b: { objId: sw.id, dx: 0, dy: 0 },
      waypoints: [],
      slackMm: 0,
    },
    {
      id: uid(),
      name: 'Cable 2',
      color: '#f4a261',
      a: { objId: sw.id, dx: 1, dy: 0 },
      b: { objId: nas.id, dx: 0, dy: 1 },
      waypoints: [],
      slackMm: 0,
    },
  ];
  const extras = [
    makeAddon('hole', 0, 0),
    makeAddon('wall', 7, 0),
    makeAddon('hole', 7, 3),
    makeAddon('wall', 0, 3),
    makeAddon('straight', 9, 5, 3),
    makeAddon('turn', 12, 5, 3, 1),
  ];
  return { objects: [p1, p2, p3, ...extras, router, sw, nas], cables };
}

function load(): { doc: Doc; view: View | null; palette: string[] } {
  try {
    const j = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (j && Array.isArray(j.doc?.objects) && Array.isArray(j.doc?.cables))
      return {
        doc: migrate(j.doc),
        view: j.view ?? null,
        palette: Array.isArray(j.palette) ? j.palette.filter((c: string) => !COLORS.includes(c)) : [],
      };
  } catch {
    /* ignore */
  }
  return { doc: seed(), view: null, palette: [] };
}

interface Store {
  doc: Doc;
  past: Doc[];
  future: Doc[];
  sel: Sel;
  tool: Tool;
  view: View;
  viewRestored: boolean;
  palette: string[];
  addColor(c: string): void;
  removeColor(c: string): void;
  wp: number | null;
  stamp: Stamp | null;
  block: Block | null;
  ids: string[];
  cids: string[];
  addonColor: string;
  clipboard: { objs: Obj[]; cables: Cable[] } | null;
  lastPaste: string;
  selectIds(ids: string[], cids?: string[]): void;
  toggleId(id: string): void;
  toggleCable(id: string): void;
  selectAll(): void;
  setBlock(b: Block): void;
  patchBlock(kind: Block['kind'], p: Partial<Block>): void;
  resizeStamp(len: number): void;
  peek: boolean;
  togglePeek(): void;
  cableColor: string;
  lastKey: string;
  lastT: number;
  txBase: Doc | null;
  hidden: Record<Layer, boolean>;
  toggleLayer(l: Layer): void;
  showLayers(...l: Layer[]): void;
  setView(v: View): void;
  setTool(t: Tool): void;
  select(s: Sel): void;
  setCableColor(c: string): void;
  commit(fn: (d: Doc) => Doc, key?: string): void;
  begin(): void;
  live(fn: (d: Doc) => Doc): void;
  end(): void;
  undo(): void;
  redo(): void;
  addCable(a: Anchor, b: Anchor, wps: Cell[]): void;
  removeSel(): void;
  duplicateSel(): void;
  rotateSel(ccw?: boolean): void;
  setWp(i: number | null): void;
  setStamp(sub: Sub, len?: number, flip?: boolean): void;
  setAddonColor(c: string): void;
  rotateStamp(ccw?: boolean): void;
  flipStamp(): void;
  flipSel(): void;
  swapStyle(): void;
  nudgeSel(dx: number, dy: number): void;
  copySel(): void;
  pasteAt(cell: Cell | null): void;
  load(doc: Doc): void;
}

const init = load();
export const useStore = create<Store>((set, get) => ({
  doc: init.doc,
  past: [],
  future: [],
  sel: null,
  tool: 'select',
  view: init.view ?? { x: 0, y: 0, k: 40 },
  viewRestored: !!init.view,
  cableColor: COLORS[0],
  lastKey: '',
  lastT: 0,
  txBase: null,
  palette: init.palette,
  addColor: (c) =>
    set((s) =>
      s.palette.includes(c.toLowerCase()) || COLORS.includes(c.toLowerCase())
        ? {}
        : { palette: [...s.palette, c.toLowerCase()] },
    ),
  removeColor: (c) => set((s) => ({ palette: s.palette.filter((x) => x !== c) })),
  wp: null,
  stamp: null,
  block: null,
  ids: [],
  cids: [],
  addonColor: ADDON_DEFAULT,
  clipboard: null,
  lastPaste: '',
  setView: (view) => set({ view }),
  setTool: (tool) =>
    set((s) => ({
      tool,
      ...(tool === 'cable' && s.hidden.cables ? { hidden: { ...s.hidden, cables: false } } : {}),
      stamp: tool === 'place' ? s.stamp : null,
      block: tool === 'place' ? s.block : null,
    })),
  select: (sel) =>
    set({
      sel,
      ids: sel?.type === 'obj' ? [sel.id] : [],
      cids: sel?.type === 'cable' ? [sel.id] : [],
      wp: null,
    }),
  selectIds: (ids, cids = []) =>
    set({
      ids,
      cids,
      sel: ids.length ? { type: 'obj', id: ids[0] } : cids.length ? { type: 'cable', id: cids[0] } : null,
      wp: null,
    }),
  toggleId: (id) => {
    const s = get();
    const next = s.ids.includes(id) ? s.ids.filter((x) => x !== id) : [...s.ids, id];
    get().selectIds(next, s.cids);
  },
  toggleCable: (id) => {
    const s = get();
    const next = s.cids.includes(id) ? s.cids.filter((x) => x !== id) : [...s.cids, id];
    get().selectIds(s.ids, next);
  },
  selectAll: () => {
    const { doc, hidden } = get();
    get().selectIds(
      doc.objects.filter((o) => !hidden[layerOf(o)]).map((o) => o.id),
      hidden.cables ? [] : doc.cables.map((c) => c.id),
    );
  },
  patchBlock: (kind, p) =>
    set((s) => {
      // edits keep the rotation already applied to the ghost
      if (!s.block || s.block.kind !== kind) return {};
      const q = s.block.swapped ? { ...p, w: p.h, h: p.w } : p;
      return {
        block: { ...s.block, ...Object.fromEntries(Object.entries(q).filter(([, v]) => v !== undefined)) },
      };
    }),
  resizeStamp: (len) => set((s) => (s.stamp ? { stamp: { ...s.stamp, len } } : {})),
  hidden: { tiles: false, objects: false, channels: false, cables: false },
  toggleLayer: (l) =>
    set((s) => {
      const hidden = { ...s.hidden, [l]: !s.hidden[l] };
      if (!hidden[l]) return { hidden };
      const byId = new Map(s.doc.objects.map((o) => [o.id, o]));
      const ids = s.ids.filter((id) => {
          const o = byId.get(id);
          return o && !hidden[layerOf(o)];
        }),
        cids = hidden.cables ? [] : s.cids;
      const one = s.sel?.type === 'obj' ? byId.get(s.sel.id) : undefined;
      const gone =
        !ids.length &&
        !cids.length &&
        (s.sel?.type === 'cable' ? hidden.cables : one ? hidden[layerOf(one)] : false);
      return {
        hidden,
        ids,
        cids,
        ...(ids.length || cids.length
          ? {
              sel: ids.length
                ? { type: 'obj' as const, id: ids[0] }
                : { type: 'cable' as const, id: cids[0] },
            }
          : gone
            ? { sel: null }
            : {}),
        wp: null,
      };
    }),
  showLayers: (...ls) =>
    set((s) =>
      ls.some((l) => s.hidden[l])
        ? { hidden: { ...s.hidden, ...Object.fromEntries(ls.map((l) => [l, false])) } }
        : {},
    ),
  peek: false,
  togglePeek: () => set((s) => ({ peek: !s.peek })),
  setBlock: (block) =>
    set((s) => ({
      hidden: { ...s.hidden, [block.kind === 'plate' ? 'tiles' : 'objects']: false },
      block,
      stamp: null,
      tool: 'place',
      sel: null,
      ids: [],
      cids: [],
      wp: null,
    })),
  setCableColor: (cableColor) => set({ cableColor }),
  commit: (fn, key) => {
    const s = get();
    const next = fn(s.doc);
    if (next === s.doc) return;
    const now = Date.now();
    const co = !!key && key === s.lastKey && now - s.lastT < 1000;
    set({
      doc: next,
      past: co ? s.past : [...s.past.slice(-99), s.doc],
      future: [],
      lastKey: key ?? '',
      lastT: now,
    });
  },
  begin: () => set({ txBase: get().doc }),
  live: (fn) => set((s) => ({ doc: fn(s.doc) })),
  end: () => {
    const s = get();
    if (s.txBase && s.txBase !== s.doc)
      set({ past: [...s.past.slice(-99), s.txBase], future: [], txBase: null, lastKey: '' });
    else set({ txBase: null });
  },
  undo: () => {
    const s = get();
    if (!s.past.length) return;
    const doc = s.past[s.past.length - 1];
    set({
      doc,
      past: s.past.slice(0, -1),
      future: [s.doc, ...s.future],
      ...changedIn(s.doc, doc, s.hidden),
      lastKey: '',
    });
  },
  redo: () => {
    const s = get();
    if (!s.future.length) return;
    const doc = s.future[0];
    set({
      doc,
      future: s.future.slice(1),
      past: [...s.past, s.doc],
      ...changedIn(s.doc, doc, s.hidden),
      lastKey: '',
    });
  },
  addCable: (a, b, wps) => {
    const s = get();
    const all = [...COLORS, ...s.palette];
    const idx = all.indexOf(s.cableColor);
    const c: Cable = {
      id: uid(),
      name: `Cable ${s.doc.cables.length + 1}`,
      color: s.cableColor,
      a,
      b,
      waypoints: wps,
      slackMm: 0,
    };
    s.commit((d) => ({ ...d, cables: [...d.cables, c] }));
    set({
      sel: { type: 'cable', id: c.id },
      wp: null,
      cableColor: all[(idx + 1) % all.length],
      tool: 'select',
    });
  },
  removeSel: () => {
    const { sel, commit, wp, ids, cids } = get();
    if (!sel) return;
    if (sel.type === 'cable' && wp !== null && !ids.length && cids.length < 2) {
      // delete just the selected cable point
      commit((d) => ({
        ...d,
        cables: d.cables.map((c) =>
          c.id === sel.id ? { ...c, waypoints: c.waypoints.filter((_, j) => j !== wp) } : c,
        ),
      }));
      set({ wp: null });
      return;
    }
    const oi = ids.length ? ids : sel.type === 'obj' ? [sel.id] : [],
      cs = new Set(cids.length ? cids : sel.type === 'cable' ? [sel.id] : []);
    commit((d) => {
      const n = oi.reduce(removeObject, d);
      return { ...n, cables: n.cables.filter((c) => !cs.has(c.id)) };
    });
    set({ sel: null, ids: [], cids: [] });
  },
  duplicateSel: () => {
    const { sel, doc, commit, ids, cids } = get();
    if (!sel) return;
    const oi = new Set(ids.length ? ids : sel.type === 'obj' ? [sel.id] : []),
      ci = new Set(cids.length ? cids : sel.type === 'cable' ? [sel.id] : []);
    const n = cloneItems(
      doc.objects.filter((o) => oi.has(o.id)),
      carried(doc.cables, oi, ci),
      1,
      1,
    );
    commit((d) => ({ objects: [...d.objects, ...n.objs], cables: [...d.cables, ...n.cables] }));
    get().showLayers(...n.objs.map(layerOf), ...(n.cables.length ? ['cables' as Layer] : []));
    get().selectIds(
      n.objs.map((o) => o.id),
      n.cables.map((c) => c.id),
    );
  },
  rotateSel: (ccw = false) => {
    const { sel, commit, ids, cids } = get();
    if (sel) {
      const oi = ids.length ? ids : sel.type === 'obj' ? [sel.id] : [],
        ci = cids.length ? cids : sel.type === 'cable' ? [sel.id] : [];
      commit((d) => {
        let n = rotateGroup(d, oi, ci);
        if (ccw) n = rotateGroup(rotateGroup(n, oi, ci), oi, ci);
        return n;
      });
    }
  },
  setWp: (wp) => set({ wp }),
  setStamp: (sub, len = 3, flip = false) =>
    set((s) => ({
      hidden: { ...s.hidden, [layerOf({ kind: kindOf(sub) })]: false },
      stamp: { sub, len, rot: 0, flip, color: s.addonColor },
      block: null,
      tool: 'place',
      sel: null,
      ids: [],
      cids: [],
      wp: null,
    })),
  setAddonColor: (addonColor) =>
    set((s) => ({ addonColor, stamp: s.stamp ? { ...s.stamp, color: addonColor } : null })),
  rotateStamp: (ccw = false) =>
    set((s) =>
      s.block
        ? { block: { ...s.block, w: s.block.h, h: s.block.w, swapped: !s.block.swapped } }
        : s.stamp
          ? { stamp: { ...s.stamp, rot: (s.stamp.rot + (ccw ? 3 : 1)) % 4 } }
          : {},
    ),
  flipStamp: () => set((s) => (s.stamp ? { stamp: { ...s.stamp, flip: !s.stamp.flip } } : {})),
  nudgeSel: (dx, dy) => {
    const s = get();
    if (s.tool === 'place') return;
    const oi = s.ids.length ? s.ids : s.sel?.type === 'obj' ? [s.sel.id] : [],
      ci = s.cids.length ? s.cids : s.sel?.type === 'cable' ? [s.sel.id] : [];
    if (oi.length + ci.length) s.commit((d) => moveGroup(d, oi, ci, dx, dy), 'nudge');
  },
  swapStyle: () => {
    const s = get();
    if (s.tool === 'place' && s.stamp) {
      const ns = counterpart(s.stamp.sub, s.stamp.len);
      if (ns) set({ stamp: { ...s.stamp, sub: ns } });
      return;
    }
    const sel = new Set(s.ids.length ? s.ids : s.sel?.type === 'obj' ? [s.sel.id] : []);
    if (!s.doc.objects.some((o) => sel.has(o.id) && counterpart(o.sub, o.w))) return;
    s.commit((d) => ({
      ...d,
      objects: d.objects.map((o) => {
        const ns = sel.has(o.id) ? counterpart(o.sub, o.w) : undefined;
        return ns ? { ...o, sub: ns, name: ADDON_LABEL[ns] ?? o.name } : o;
      }),
    }));
  },
  flipSel: () => {
    const { sel, commit, ids, cids } = get();
    if (sel?.type === 'obj' && ids.length + cids.length < 2)
      commit((d) => ({
        ...d,
        objects: d.objects.map((o) => (o.id === sel.id && isShaped(o.sub) ? { ...o, flip: !o.flip } : o)),
      }));
  },
  copySel: () => {
    const { sel, doc, ids, cids } = get();
    if (!sel) return;
    const oi = new Set(ids.length ? ids : sel.type === 'obj' ? [sel.id] : []),
      ci = new Set(cids.length ? cids : sel.type === 'cable' ? [sel.id] : []);
    set({
      clipboard: { objs: doc.objects.filter((o) => oi.has(o.id)), cables: carried(doc.cables, oi, ci) },
      lastPaste: '',
    });
  },
  pasteAt: (cell) => {
    const { clipboard: c, commit, lastPaste } = get();
    if (!c || !(c.objs.length || c.cables.length)) return;
    const b = boxOfAll(c.objs, c.cables);
    let x = cell ? cell.x : b.x + 1,
      y = cell ? cell.y : b.y + 1;
    if (`${x},${y}` === lastPaste) {
      x++;
      y++;
    }
    const n = cloneItems(c.objs, c.cables, x - b.x, y - b.y);
    commit((d) => ({ objects: [...d.objects, ...n.objs], cables: [...d.cables, ...n.cables] }));
    get().showLayers(...n.objs.map(layerOf), ...(n.cables.length ? ['cables' as Layer] : []));
    get().selectIds(
      n.objs.map((o) => o.id),
      n.cables.map((q) => q.id),
    );
    set({ lastPaste: `${x},${y}` });
  },
  load: (doc) => {
    get().commit(() => doc);
    set({ sel: null, ids: [], cids: [] });
  },
}));

let t: any;
useStore.subscribe((s, p) => {
  if (s.doc === p.doc && s.view === p.view && s.palette === p.palette) return;
  clearTimeout(t);
  t = setTimeout(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify({ doc: s.doc, view: s.view, palette: s.palette }));
    } catch {
      /* ignore */
    }
  }, 300);
});
