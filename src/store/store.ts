import { create } from 'zustand';
import { partsById } from '../domain/anchors';
import { BASE_ZOOM, DEFAULT_COLORS, PIECE_COLOR } from '../domain/constants';
import { deleteWaypoint, isBomPart, moveCable, removePart, setInBom } from '../domain/doc';
import { carriedCables, cloneItems, moveGroup, rotateGroup, selectionBounds } from '../domain/group';
import { uid } from '../domain/id';
import { type Layer, layerOf } from '../domain/layers';
import { counterpart, flipped, isShaped, kindOfPiece, PIECE_LABELS } from '../domain/pieces';
import type {
  Anchor,
  Block,
  Cable,
  Cell,
  Doc,
  Part,
  PieceType,
  Selection,
  Stamp,
  Tool,
  View,
} from '../domain/types';
import { autosave, loadSaved } from './persistence';

/** Undo steps kept. */
const HISTORY_LIMIT = 100;
/** Commits sharing a key within this window are one undo step. */
const COALESCE_MS = 1000;

export interface EditorState {
  // Layout and history
  doc: Doc;
  past: Doc[];
  future: Doc[];
  /** Key and time of the last commit, for coalescing. */
  coalesceKey: string;
  coalescedAt: number;
  /** Layout before the current live edit (drag), or null. */
  dragBase: Doc | null;

  // Selection: `selection` is the primary item; the id lists hold everything selected.
  selection: Selection;
  selectedIds: string[];
  selectedCableIds: string[];
  /** Index of the selected waypoint of the selected cable. */
  activeWaypoint: number | null;
  clipboard: { parts: Part[]; cables: Cable[] } | null;
  /** Cell of the last paste, so pasting twice in a row offsets the copy. */
  lastPasteAt: string;

  // Tools and placing
  tool: Tool;
  stamp: Stamp | null;
  block: Block | null;
  pieceColor: string;
  cableColor: string;
  /** Custom swatches. */
  palette: string[];

  // View
  view: View;
  viewRestored: boolean;
  peek: boolean;
  /** Cables under the pointer (or hovered in the list). View-only: not saved or undone. */
  hoverCableIds: string[];
  hidden: Record<Layer, boolean>;
  /** The right-hand panel (selection and bill of materials). */
  sidebarOpen: boolean;

  commit(edit: (doc: Doc) => Doc, key?: string): void;
  beginLive(): void;
  /** Edits without history, for drags; `endLive` records the whole drag as one step. */
  live(edit: (doc: Doc) => Doc): void;
  endLive(): void;
  undo(): void;
  redo(): void;
  replaceDoc(doc: Doc): void;

  select(selection: Selection): void;
  selectItems(partIds: string[], cableIds?: string[]): void;
  togglePart(id: string): void;
  toggleCable(id: string): void;
  selectAll(): void;
  setActiveWaypoint(index: number | null): void;

  deleteSelection(): void;
  duplicateSelection(): void;
  rotateSelection(counterClockwise?: boolean): void;
  flipSelection(): void;
  nudgeSelection(dx: number, dy: number): void;
  swapStyle(): void;
  /** Includes the selected parts in, or leaves them out of, the bill of materials. */
  setSelectionInBom(include: boolean): void;
  copySelection(): void;
  pasteAt(cell: Cell | null): void;
  addCable(a: Anchor, b: Anchor, waypoints: Cell[]): void;
  /** Moves a cable in the list, and so in the drawing order. */
  moveCable(id: string, index: number): void;

  setTool(tool: Tool): void;
  setStamp(sub: PieceType, len?: number, flip?: boolean): void;
  resizeStamp(len: number): void;
  rotateStamp(counterClockwise?: boolean): void;
  flipStamp(): void;
  setBlock(block: Block): void;
  patchBlock(kind: Block['kind'], patch: Partial<Block>): void;
  setPieceColor(color: string): void;
  setCableColor(color: string): void;
  addColor(color: string): void;
  removeColor(color: string): void;

  setView(view: View): void;
  togglePeek(): void;
  setHoverCables(ids: string[]): void;
  toggleSidebar(): void;
  toggleLayer(layer: Layer): void;
  showLayers(...layers: Layer[]): void;
}

type SelectionFields = Pick<EditorState, 'selection' | 'selectedIds' | 'selectedCableIds' | 'activeWaypoint'>;
type SelectionState = Pick<EditorState, 'doc' | 'selection' | 'selectedIds' | 'selectedCableIds'>;

export const isGroupSelected = (s: SelectionState) => s.selectedIds.length + s.selectedCableIds.length > 1;

/** The selected part, when exactly one part (and no cable) is selected. */
export const selectedPart = (s: SelectionState) =>
  !isGroupSelected(s) && s.selection?.type === 'obj'
    ? s.doc.objects.find((p) => p.id === s.selection!.id)
    : undefined;

/** The selected cable, when the primary selection is a cable and no group is selected. */
export const selectedCable = (s: SelectionState) =>
  !isGroupSelected(s) && s.selection?.type === 'cable'
    ? s.doc.cables.find((c) => c.id === s.selection!.id)
    : undefined;

/** True when the selection is one cable alone, so its waypoints can be edited. */
const editingCablePoints = (s: SelectionState) =>
  s.selection?.type === 'cable' && !s.selectedIds.length && s.selectedCableIds.length < 2;

/** The cable whose waypoints the toolbar edits, when the selection is one cable alone. */
export const pointEditableCable = (s: SelectionState) =>
  editingCablePoints(s) ? s.doc.cables.find((c) => c.id === s.selection!.id) : undefined;

/** Selected parts that have a rounded/angled counterpart. */
const swappable = (s: SelectionState) => {
  const parts = new Set(targets(s).partIds);
  return s.doc.objects.filter((p) => parts.has(p.id) && counterpart(p.sub, p.w));
};
export const canSwapStyle = (s: SelectionState) => swappable(s).length > 0;
export const canFlip = (s: SelectionState) => isShaped(selectedPart(s)?.sub);

/** Whether the selected parts are in the bill of materials: all, none, `mixed`, or `undefined` with no parts. */
export const selectionInBom = (s: SelectionState): boolean | 'mixed' | undefined => {
  const { partIds } = targets(s);
  if (!partIds.length) return undefined;
  const parts = new Set(partIds);
  let state: boolean | undefined;
  for (const p of s.doc.objects) {
    if (!parts.has(p.id) || !isBomPart(p)) continue;
    if (state === undefined) state = !p.noBom;
    else if (state !== !p.noBom) return 'mixed';
  }
  return state;
};

/** Selection of these items, with the first part (or else the first cable) as primary. */
function selectionOf(partIds: string[], cableIds: string[]): SelectionFields {
  const selection: Selection = partIds.length
    ? { type: 'obj', id: partIds[0] }
    : cableIds.length
      ? { type: 'cable', id: cableIds[0] }
      : null;
  return { selection, selectedIds: partIds, selectedCableIds: cableIds, activeWaypoint: null };
}

const NO_SELECTION: SelectionFields = selectionOf([], []);

/** What an action applies to: the multi-selection, or else the primary selection. */
export function targets(s: SelectionState) {
  const { selection } = s;
  return {
    partIds: s.selectedIds.length ? s.selectedIds : selection?.type === 'obj' ? [selection.id] : [],
    cableIds: s.selectedCableIds.length
      ? s.selectedCableIds
      : selection?.type === 'cable'
        ? [selection.id]
        : [],
  };
}

/**
 * Ids in `after` that moved relative to `before`: those outside the longest common subsequence of the two orders.
 * For a single move that is just the moved item.
 */
function movedIds(before: string[], after: string[]): Set<string> {
  if (before.join('\n') === after.join('\n')) return new Set();
  // lcs[i][j]: LCS length of before[i..] and after[j..].
  const lcs = before.map(() => new Array<number>(after.length + 1).fill(0));
  lcs.push(new Array<number>(after.length + 1).fill(0));
  for (let i = before.length - 1; i >= 0; i--) {
    for (let j = after.length - 1; j >= 0; j--) {
      lcs[i][j] = before[i] === after[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }
  const moved = new Set(after);
  for (let i = 0, j = 0; i < before.length && j < after.length;) {
    if (before[i] === after[j]) {
      moved.delete(after[j]);
      i++;
      j++;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) i++;
    else j++;
  }
  return moved;
}

/** Items in `to` added, changed or moved relative to `from` (what an undo or redo touched), as a selection. */
function changedIn(from: Doc, to: Doc, hidden: Record<Layer, boolean>): SelectionFields {
  const changed = <T extends { id: string }>(before: T[], after: T[]) => {
    const old = new Map(before.map((x) => [x.id, x]));
    return after.filter((x) => {
      const y = old.get(x.id);
      return !y || (y !== x && JSON.stringify(y) !== JSON.stringify(x));
    });
  };
  const partIds = changed(from.objects, to.objects)
    .filter((p) => !hidden[layerOf(p)])
    .map((p) => p.id);
  const edited = new Set(changed(from.cables, to.cables).map((c) => c.id));
  const moved = movedIds(
    from.cables.map((c) => c.id),
    to.cables.map((c) => c.id),
  );
  const cableIds = hidden.cables
    ? []
    : to.cables.filter((c) => edited.has(c.id) || moved.has(c.id)).map((c) => c.id);
  return selectionOf(partIds, cableIds);
}

const pushHistory = (past: Doc[], doc: Doc) => [...past.slice(-(HISTORY_LIMIT - 1)), doc];

const saved = loadSaved();

export const useStore = create<EditorState>((set, get) => ({
  doc: saved.doc,
  past: [],
  future: [],
  coalesceKey: '',
  coalescedAt: 0,
  dragBase: null,
  ...NO_SELECTION,
  clipboard: null,
  lastPasteAt: '',
  tool: 'select',
  stamp: null,
  block: null,
  pieceColor: PIECE_COLOR,
  cableColor: DEFAULT_COLORS[0],
  palette: saved.palette,
  view: saved.view ?? { x: 0, y: 0, k: BASE_ZOOM },
  viewRestored: !!saved.view,
  peek: false,
  hoverCableIds: [],
  sidebarOpen: true,
  hidden: { tiles: false, objects: false, channels: false, cables: false },

  // ---- layout and history ----

  commit: (edit, key) => {
    const s = get();
    const doc = edit(s.doc);
    if (doc === s.doc) return;
    const now = Date.now();
    const coalesce = !!key && key === s.coalesceKey && now - s.coalescedAt < COALESCE_MS;
    set({
      doc,
      past: coalesce ? s.past : pushHistory(s.past, s.doc),
      future: [],
      coalesceKey: key ?? '',
      coalescedAt: now,
    });
  },
  beginLive: () => set({ dragBase: get().doc }),
  live: (edit) => {
    const doc = edit(get().doc);
    if (doc !== get().doc) set({ doc });
  },
  endLive: () => {
    const s = get();
    if (s.dragBase && s.dragBase !== s.doc) {
      set({ past: pushHistory(s.past, s.dragBase), future: [], dragBase: null, coalesceKey: '' });
    } else {
      set({ dragBase: null });
    }
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
      coalesceKey: '',
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
      coalesceKey: '',
    });
  },
  replaceDoc: (doc) => {
    get().commit(() => doc);
    set({ selection: null, selectedIds: [], selectedCableIds: [] });
  },

  // ---- selection ----

  select: (selection) =>
    set(
      selectionOf(
        selection?.type === 'obj' ? [selection.id] : [],
        selection?.type === 'cable' ? [selection.id] : [],
      ),
    ),
  selectItems: (partIds, cableIds = []) => set(selectionOf(partIds, cableIds)),
  togglePart: (id) => {
    const { selectedIds, selectedCableIds } = get();
    const next = selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id];
    get().selectItems(next, selectedCableIds);
  },
  toggleCable: (id) => {
    const { selectedIds, selectedCableIds } = get();
    const next = selectedCableIds.includes(id)
      ? selectedCableIds.filter((x) => x !== id)
      : [...selectedCableIds, id];
    get().selectItems(selectedIds, next);
  },
  selectAll: () => {
    const { doc, hidden } = get();
    get().selectItems(
      doc.objects.filter((p) => !hidden[layerOf(p)]).map((p) => p.id),
      hidden.cables ? [] : doc.cables.map((c) => c.id),
    );
  },
  setActiveWaypoint: (activeWaypoint) => set({ activeWaypoint }),

  // ---- editing the selection ----

  deleteSelection: () => {
    const s = get();
    const { selection, activeWaypoint } = s;
    if (!selection) return;
    if (selection.type === 'cable' && activeWaypoint !== null && editingCablePoints(s)) {
      // Delete just the selected waypoint.
      s.commit((d) => deleteWaypoint(d, selection.id, activeWaypoint));
      set({ activeWaypoint: null });
      return;
    }
    const { partIds, cableIds } = targets(s);
    const cables = new Set(cableIds);
    s.commit((d) => {
      const rest = partIds.reduce(removePart, d);
      return { ...rest, cables: rest.cables.filter((c) => !cables.has(c.id)) };
    });
    set({ selection: null, selectedIds: [], selectedCableIds: [] });
  },
  duplicateSelection: () => {
    const s = get();
    if (!s.selection) return;
    const { partIds, cableIds } = targets(s);
    const parts = new Set(partIds);
    const copies = cloneItems(
      s.doc.objects.filter((p) => parts.has(p.id)),
      carriedCables(s.doc.cables, parts, new Set(cableIds)),
      1,
      1,
    );
    addCopies(copies);
  },
  rotateSelection: (counterClockwise = false) => {
    const s = get();
    if (!s.selection) return;
    const { partIds, cableIds } = targets(s);
    s.commit((d) => {
      const turns = counterClockwise ? 3 : 1;
      let rotated = d;
      for (let i = 0; i < turns; i++) rotated = rotateGroup(rotated, partIds, cableIds);
      return rotated;
    });
  },
  flipSelection: () => {
    const s = get();
    const part = selectedPart(s);
    if (!part || !isShaped(part.sub)) return;
    s.commit((d) => ({
      ...d,
      objects: d.objects.map((p) => (p.id === part.id ? { ...p, ...flipped(p) } : p)),
    }));
  },
  nudgeSelection: (dx, dy) => {
    const s = get();
    if (s.tool === 'place') return;
    const { partIds, cableIds } = targets(s);
    if (partIds.length + cableIds.length) s.commit((d) => moveGroup(d, partIds, cableIds, dx, dy), 'nudge');
  },
  swapStyle: () => {
    const s = get();
    if (s.tool === 'place' && s.stamp) {
      const sub = counterpart(s.stamp.sub, s.stamp.len);
      if (sub) set({ stamp: { ...s.stamp, sub } });
      return;
    }
    const parts = new Set(swappable(s).map((p) => p.id));
    if (!parts.size) return;
    s.commit((d) => ({
      ...d,
      objects: d.objects.map((p) => {
        const sub = parts.has(p.id) ? counterpart(p.sub, p.w) : undefined;
        return sub ? { ...p, sub, name: PIECE_LABELS[sub] ?? p.name } : p;
      }),
    }));
  },
  setSelectionInBom: (include) => {
    const s = get();
    s.commit((d) => setInBom(d, targets(s).partIds, include));
  },
  copySelection: () => {
    const s = get();
    if (!s.selection) return;
    const { partIds, cableIds } = targets(s);
    const parts = new Set(partIds);
    set({
      clipboard: {
        parts: s.doc.objects.filter((p) => parts.has(p.id)),
        cables: carriedCables(s.doc.cables, parts, new Set(cableIds)),
      },
      lastPasteAt: '',
    });
  },
  pasteAt: (cell) => {
    const { clipboard, lastPasteAt } = get();
    if (!clipboard || !(clipboard.parts.length || clipboard.cables.length)) return;
    const box = selectionBounds(clipboard.parts, clipboard.cables);
    let x = cell ? cell.x : box.x + 1;
    let y = cell ? cell.y : box.y + 1;
    if (`${x},${y}` === lastPasteAt) {
      x++;
      y++;
    }
    addCopies(cloneItems(clipboard.parts, clipboard.cables, x - box.x, y - box.y));
    set({ lastPasteAt: `${x},${y}` });
  },
  moveCable: (id, index) => get().commit((d) => moveCable(d, id, index)),
  addCable: (a, b, waypoints) => {
    const s = get();
    const colors = [...DEFAULT_COLORS, ...s.palette];
    const cable: Cable = {
      id: uid(),
      name: `Cable ${s.doc.cables.length + 1}`,
      color: s.cableColor,
      a,
      b,
      waypoints,
      slackMm: 0,
    };
    s.commit((d) => ({ ...d, cables: [...d.cables, cable] }));
    set({
      ...selectionOf([], [cable.id]),
      cableColor: colors[(colors.indexOf(s.cableColor) + 1) % colors.length],
      tool: 'select',
    });
  },

  // ---- tools and placing ----

  setTool: (tool) =>
    set((s) => ({
      tool,
      ...(tool === 'cable' && s.hidden.cables ? { hidden: { ...s.hidden, cables: false } } : {}),
      stamp: tool === 'place' ? s.stamp : null,
      block: tool === 'place' ? s.block : null,
    })),
  setStamp: (sub, len = 3, flip = false) =>
    set((s) => ({
      ...NO_SELECTION,
      hidden: { ...s.hidden, [layerOf({ kind: kindOfPiece(sub) })]: false },
      stamp: { sub, len, rot: 0, flip, color: s.pieceColor },
      block: null,
      tool: 'place',
    })),
  resizeStamp: (len) => set((s) => (s.stamp ? { stamp: { ...s.stamp, len } } : {})),
  rotateStamp: (counterClockwise = false) =>
    set((s) => {
      if (s.block) return { block: { ...s.block, w: s.block.h, h: s.block.w, swapped: !s.block.swapped } };
      if (s.stamp) return { stamp: { ...s.stamp, rot: (s.stamp.rot + (counterClockwise ? 3 : 1)) % 4 } };
      return {};
    }),
  flipStamp: () => set((s) => (s.stamp ? { stamp: { ...s.stamp, ...flipped(s.stamp) } } : {})),
  setBlock: (block) =>
    set((s) => ({
      ...NO_SELECTION,
      hidden: { ...s.hidden, [layerOf(block)]: false },
      block,
      stamp: null,
      tool: 'place',
    })),
  patchBlock: (kind, patch) =>
    set((s) => {
      if (!s.block || s.block.kind !== kind) return {};
      // Edits keep the rotation already applied to the ghost.
      const oriented = s.block.swapped ? { ...patch, w: patch.h, h: patch.w } : patch;
      const defined = Object.fromEntries(Object.entries(oriented).filter(([, v]) => v !== undefined));
      return { block: { ...s.block, ...defined } };
    }),
  setPieceColor: (pieceColor) =>
    set((s) => ({ pieceColor, stamp: s.stamp ? { ...s.stamp, color: pieceColor } : null })),
  setCableColor: (cableColor) => set({ cableColor }),
  addColor: (color) =>
    set((s) => {
      const c = color.toLowerCase();
      return s.palette.includes(c) || DEFAULT_COLORS.includes(c) ? {} : { palette: [...s.palette, c] };
    }),
  removeColor: (color) => set((s) => ({ palette: s.palette.filter((c) => c !== color) })),

  // ---- view ----

  setView: (view) => set({ view }),
  togglePeek: () => set((s) => ({ peek: !s.peek })),
  setHoverCables: (ids) =>
    set((s) =>
      ids.length === s.hoverCableIds.length && ids.every((id, i) => id === s.hoverCableIds[i])
        ? s
        : { hoverCableIds: ids },
    ),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  toggleLayer: (layer) =>
    set((s) => {
      const hidden = { ...s.hidden, [layer]: !s.hidden[layer] };
      if (!hidden[layer]) return { hidden };
      // Hiding a layer drops its items from the selection.
      const byId = partsById(s.doc.objects);
      const selectedIds = s.selectedIds.filter((id) => {
        const part = byId.get(id);
        return part && !hidden[layerOf(part)];
      });
      const selectedCableIds = hidden.cables ? [] : s.selectedCableIds;
      if (selectedIds.length || selectedCableIds.length) {
        return { hidden, ...selectionOf(selectedIds, selectedCableIds) };
      }
      const primary = s.selection?.type === 'obj' ? byId.get(s.selection.id) : undefined;
      const primaryHidden =
        s.selection?.type === 'cable' ? hidden.cables : primary ? hidden[layerOf(primary)] : false;
      return {
        hidden,
        selectedIds,
        selectedCableIds,
        activeWaypoint: null,
        ...(primaryHidden ? { selection: null } : {}),
      };
    }),
  showLayers: (...layers) =>
    set((s) =>
      layers.some((l) => s.hidden[l])
        ? { hidden: { ...s.hidden, ...Object.fromEntries(layers.map((l) => [l, false])) } }
        : {},
    ),
}));

/** Adds copies to the layout, shows their layers and selects them. */
function addCopies(copies: { parts: Part[]; cables: Cable[] }) {
  const s = useStore.getState();
  s.commit((d) => ({ objects: [...d.objects, ...copies.parts], cables: [...d.cables, ...copies.cables] }));
  s.showLayers(...copies.parts.map(layerOf), ...(copies.cables.length ? (['cables'] as Layer[]) : []));
  s.selectItems(
    copies.parts.map((p) => p.id),
    copies.cables.map((c) => c.id),
  );
}

autosave(useStore);
