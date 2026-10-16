import { type MouseEvent, type PointerEvent, type RefObject, useRef } from 'react';
import { sameCell } from '../../domain/anchors';
import {
  insertWaypoint,
  isNamed,
  moveCableEnd,
  moveWaypoint,
  placeBlock,
  placeStamp,
  resizePart,
} from '../../domain/doc';
import { moveGroup, pinCables } from '../../domain/group';
import { layerOf } from '../../domain/layers';
import { stampSize } from '../../domain/pieces';
import type { Cell, Doc, Selection } from '../../domain/types';
import { cellCenter } from '../../routing/paths';
import { nearestLeg, type Route } from '../../routing/route';
import { type EditorState, isGroupSelected, useStore } from '../../store/store';
import { pointer } from '../../store/view';
import type { CableDraftApi } from './useCableDraft';

/** Two clicks on the same item within this time are a double-click. */
const DOUBLE_CLICK_MS = 400;
/** Pointer travel (pixels) before a press on empty canvas becomes a selection box. */
const MARQUEE_THRESHOLD = 4;
const PAN_THRESHOLD = 3;

export interface Marquee {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** What the current pointer press is doing, until it is released. */
type Drag =
  | { t: 'pan'; sx: number; sy: number; vx: number; vy: number; moved: boolean }
  | {
      t: 'move';
      ids: string[];
      cids: string[];
      fx: number;
      fy: number;
      /** The layout before the drag, and the same with the selected cables pinned to their paths. */
      base: Doc;
      pinned: Doc;
      /** Offset last applied, so pointer moves within a cell do nothing. */
      dx: number;
      dy: number;
      moved: boolean;
      /** A click (no move) on an item of a group selects just that item. */
      collapse?: Selection;
    }
  | {
      t: 'marquee';
      sx: number;
      sy: number;
      add: boolean;
      base: string[];
      baseC: string[];
      /** A click (no move) toggles this item in the selection. */
      toggle?: Selection;
      moved: boolean;
    }
  | { t: 'wp'; cableId: string; i: number }
  | { t: 'end'; cableId: string; end: 'a' | 'b' }
  | { t: 'resize'; id: string }
  | { t: 'paint'; last: string };

interface PointerInputOptions {
  svgRef: RefObject<SVGSVGElement | null>;
  routes: Map<string, Route>;
  spaceHeld: boolean;
  draft: CableDraftApi;
  setHover: (update: (hover: Cell | null) => Cell | null) => void;
  setMarquee: (marquee: Marquee | null) => void;
  startRename: (id: string) => void;
}

const cellKey = (c: Cell) => `${c.x},${c.y}`;
const hasModifier = (e: PointerEvent) => e.shiftKey || e.metaKey || e.ctrlKey;

/** Parts and cables (by drawn route) touching the box, on visible layers. */
function itemsInBox(s: EditorState, routes: Map<string, Route>, box: Marquee) {
  const parts = s.doc.objects
    .filter(
      (p) =>
        !s.hidden[layerOf(p)] && p.x < box.x1 && p.x + p.w > box.x0 && p.y < box.y1 && p.y + p.h > box.y0,
    )
    .map((p) => p.id);
  const cables = s.hidden.cables
    ? []
    : s.doc.cables
        .filter((c) => {
          const route = routes.get(c.id);
          if (!route) return false;
          const points = route.draw.map(cellCenter);
          return points.some((p, i) => {
            const q = points[i + 1] ?? p;
            return (
              Math.max(p.x, q.x) >= box.x0 &&
              Math.min(p.x, q.x) <= box.x1 &&
              Math.max(p.y, q.y) >= box.y0 &&
              Math.min(p.y, q.y) <= box.y1
            );
          });
        })
        .map((c) => c.id);
  return { parts, cables };
}

/** Pointer handling for the canvas: tools, selection, dragging, resizing and the selection box. */
export function usePointerInput(options: PointerInputOptions) {
  const { svgRef, spaceHeld, draft, setHover, setMarquee, startRename } = options;
  const drag = useRef<Drag | null>(null);
  const lastWaypointClick = useRef({ key: '', at: 0 });
  const lastPartClick = useRef({ id: '', at: 0 });
  const routes = useRef(options.routes);
  routes.current = options.routes;

  const toWorld = (clientX: number, clientY: number): Cell => {
    const rect = svgRef.current!.getBoundingClientRect();
    const { view } = useStore.getState();
    return { x: (clientX - rect.left - view.x) / view.k, y: (clientY - rect.top - view.y) / view.k };
  };
  const cellAt = (w: Cell): Cell => ({ x: Math.floor(w.x), y: Math.floor(w.y) });

  const onPointerDown = (e: PointerEvent) => {
    const s = useStore.getState();
    const w = toWorld(e.clientX, e.clientY);
    const cell = cellAt(w);
    const target = (e.target as Element).closest('[data-k]') as SVGElement | null;
    const kind = target?.getAttribute('data-k');
    const id = target?.getAttribute('data-id') ?? '';
    svgRef.current!.setPointerCapture(e.pointerId);
    const startPan = () => {
      drag.current = { t: 'pan', sx: e.clientX, sy: e.clientY, vx: s.view.x, vy: s.view.y, moved: false };
    };
    const startMove = (ids: string[], cids: string[], collapse?: Selection) => {
      s.beginLive();
      drag.current = {
        t: 'move',
        ids,
        cids,
        fx: w.x,
        fy: w.y,
        base: s.doc,
        // Selected cables keep the shape they have now and move with the selection.
        pinned: pinCables(s.doc, cids, ids, routes.current),
        dx: 0,
        dy: 0,
        moved: false,
        collapse,
      };
    };

    if (e.button === 1 || (e.button === 0 && spaceHeld)) {
      e.preventDefault();
      startPan();
      return;
    }
    if (e.button !== 0) return;
    if (s.tool === 'pan') return startPan();
    if (s.tool === 'cable') return draft.click(cell);
    if (s.tool === 'place') {
      if (s.block) {
        s.beginLive();
        s.live(placeBlock(s.block, cell));
        drag.current = { t: 'paint', last: '' };
      } else if (s.stamp) {
        s.beginLive();
        s.live(placeStamp(s.stamp, cell));
        drag.current = { t: 'paint', last: cellKey(cell) };
      }
      return;
    }

    const groupSelected = isGroupSelected(s);
    const toggleBox = (toggle: Selection) => {
      drag.current = {
        t: 'marquee',
        sx: w.x,
        sy: w.y,
        add: true,
        base: s.selectedIds,
        baseC: s.selectedCableIds,
        toggle,
        moved: false,
      };
    };

    if (kind === 'wp') {
      const i = +target!.getAttribute('data-i')!;
      const key = `${id}:${i}`;
      const now = Date.now();
      if (lastWaypointClick.current.key === key && now - lastWaypointClick.current.at < DOUBLE_CLICK_MS) {
        // Double-click deletes the point.
        s.setActiveWaypoint(i);
        s.deleteSelection();
        lastWaypointClick.current = { key: '', at: 0 };
        return;
      }
      lastWaypointClick.current = { key, at: now };
      s.setActiveWaypoint(i);
      s.beginLive();
      drag.current = { t: 'wp', cableId: id, i };
      return;
    }
    if (kind === 'end') {
      s.beginLive();
      drag.current = { t: 'end', cableId: id, end: target!.getAttribute('data-end') as 'a' | 'b' };
      return;
    }
    if (kind === 'resize') {
      s.beginLive();
      drag.current = { t: 'resize', id };
      return;
    }
    if (kind === 'cable') {
      if (hasModifier(e)) return toggleBox({ type: 'cable', id });
      // Part of a group: dragging moves everything.
      if (groupSelected && s.selectedCableIds.includes(id)) {
        return startMove(s.selectedIds, s.selectedCableIds, { type: 'cable', id });
      }
      const alreadySelected = s.selection?.type === 'cable' && s.selection.id === id && !groupSelected;
      if (!alreadySelected) return s.select({ type: 'cable', id });
      // Dragging a selected cable pulls out a new waypoint.
      const route = routes.current.get(id);
      if (!route) return;
      const i = nearestLeg(route, cell);
      s.beginLive();
      s.live((d) => insertWaypoint(d, id, i, cell));
      s.setActiveWaypoint(i);
      drag.current = { t: 'wp', cableId: id, i };
      return;
    }
    if (kind === 'obj') {
      const part = s.doc.objects.find((p) => p.id === id);
      if (!part) return;
      // Shift-click toggles; shift-drag sweeps a box that adds to the selection.
      if (hasModifier(e)) return toggleBox({ type: 'obj', id });
      const inGroup = groupSelected && s.selectedIds.includes(id);
      if (!inGroup) s.select({ type: 'obj', id });
      const now = Date.now();
      if (
        isNamed(part) &&
        lastPartClick.current.id === id &&
        now - lastPartClick.current.at < DOUBLE_CLICK_MS
      ) {
        lastPartClick.current = { id: '', at: 0 };
        e.preventDefault();
        startRename(id);
        return;
      }
      lastPartClick.current = { id, at: now };
      if (inGroup) startMove(s.selectedIds, s.selectedCableIds, { type: 'obj', id });
      else startMove([id], []);
      return;
    }
    drag.current = {
      t: 'marquee',
      sx: w.x,
      sy: w.y,
      add: e.shiftKey,
      base: e.shiftKey ? s.selectedIds : [],
      baseC: e.shiftKey ? s.selectedCableIds : [],
      moved: false,
    };
  };

  const onPointerMove = (e: PointerEvent) => {
    const s = useStore.getState();
    const w = toWorld(e.clientX, e.clientY);
    const cell = cellAt(w);
    pointer.cell = cell;
    if (s.tool !== 'select') setHover((hover) => (sameCell(hover, cell) ? hover : cell));
    const d = drag.current;
    if (!d) return;
    switch (d.t) {
      case 'pan': {
        const dx = e.clientX - d.sx;
        const dy = e.clientY - d.sy;
        if (Math.abs(dx) + Math.abs(dy) > PAN_THRESHOLD) d.moved = true;
        s.setView({ ...s.view, x: d.vx + dx, y: d.vy + dy });
        break;
      }
      case 'move': {
        const dx = Math.round(w.x - d.fx);
        const dy = Math.round(w.y - d.fy);
        if (dx || dy) d.moved = true;
        if (dx === d.dx && dy === d.dy) break;
        d.dx = dx;
        d.dy = dy;
        // Back at the start, nothing has moved, so nothing is pinned either.
        s.live(() => (dx || dy ? moveGroup(d.pinned, d.ids, d.cids, dx, dy) : d.base));
        break;
      }
      case 'marquee': {
        if (!d.moved && Math.hypot(w.x - d.sx, w.y - d.sy) * s.view.k < MARQUEE_THRESHOLD) return;
        d.moved = true;
        const box = {
          x0: Math.min(w.x, d.sx),
          x1: Math.max(w.x, d.sx),
          y0: Math.min(w.y, d.sy),
          y1: Math.max(w.y, d.sy),
        };
        setMarquee(box);
        const hit = itemsInBox(s, routes.current, box);
        s.selectItems(
          d.add ? [...new Set([...d.base, ...hit.parts])] : hit.parts,
          d.add ? [...new Set([...d.baseC, ...hit.cables])] : hit.cables,
        );
        break;
      }
      case 'wp':
        s.live((doc) => moveWaypoint(doc, d.cableId, d.i, cell));
        break;
      case 'end':
        s.live((doc) => moveCableEnd(doc, d.cableId, d.end, cell, s.hidden.objects));
        break;
      case 'resize':
        s.live((doc) => resizePart(doc, d.id, cell));
        break;
      case 'paint': {
        // Dragging paints 1×1 pieces (snaps) onto every cell passed over.
        const key = cellKey(cell);
        const { stamp } = s;
        if (key === d.last || !stamp) break;
        const size = stampSize(stamp);
        if (size.w === 1 && size.h === 1) {
          d.last = key;
          s.live(placeStamp(stamp, cell));
        }
        break;
      }
    }
  };

  const onPointerUp = (e: PointerEvent) => {
    const d = drag.current;
    drag.current = null;
    try {
      svgRef.current!.releasePointerCapture(e.pointerId);
    } catch {
      // capture already released
    }
    if (!d) return;
    const s = useStore.getState();
    if (d.t === 'pan') return;
    if (d.t === 'marquee') {
      setMarquee(null);
      if (d.moved) return;
      if (d.toggle) {
        if (d.toggle.type === 'obj') s.togglePart(d.toggle.id);
        else s.toggleCable(d.toggle.id);
      } else if (!d.add) {
        s.select(null);
      }
      return;
    }
    if (d.t === 'move' && !d.moved && d.collapse) s.select(d.collapse);
    s.endLive();
  };

  const onPointerLeave = () => {
    pointer.cell = null;
  };

  const onContextMenu = (e: MouseEvent) => {
    e.preventDefault();
    const s = useStore.getState();
    if (s.tool === 'place') return s.setTool('select');
    if (draft.draft) return draft.undoPoint();
    // Right-click on a waypoint deletes it.
    const waypoint = (e.target as Element).closest('[data-k="wp"]');
    if (waypoint) {
      s.select({ type: 'cable', id: waypoint.getAttribute('data-id')! });
      s.setActiveWaypoint(+waypoint.getAttribute('data-i')!);
      s.deleteSelection();
      return;
    }
    if (s.tool !== 'select') return;
    // Right-clicking an unselected part or cable selects just it, as in most editors; the menu acts on the selection.
    // Looked up at the point: the pointer is captured for the press, which retargets this event to the canvas itself.
    const target = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-k]');
    const id = target?.getAttribute('data-id') ?? '';
    if (target?.getAttribute('data-k') === 'obj' && !s.selectedIds.includes(id))
      s.select({ type: 'obj', id });
    if (target?.getAttribute('data-k') === 'cable' && !s.selectedCableIds.includes(id))
      s.select({ type: 'cable', id });
    s.openSelectionMenu(e.clientX, e.clientY);
  };

  return { drag, onPointerDown, onPointerMove, onPointerUp, onPointerLeave, onContextMenu };
}
