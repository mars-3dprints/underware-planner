import { PIECE_COLOR } from './constants';
import { uid } from './id';
import { anchorAt, sameAnchor, sameCell } from './anchors';
import {
  clampTurnSize,
  isLinear,
  isTurn,
  isVertical,
  kindOfPiece,
  lengthPatch,
  minLength,
  PIECE_LABELS,
  stampSize,
} from './pieces';
import type { Anchor, Block, Cable, Cell, Doc, Part, PieceType, Stamp } from './types';

/** Keeps an attached cable end inside its part after a resize. */
const clampAnchor = (end: Anchor, part: Part): Anchor =>
  end.objId === undefined
    ? end
    : {
        ...end,
        dx: Math.max(0, Math.min(part.w - 1, end.dx)),
        dy: Math.max(0, Math.min(part.h - 1, end.dy)),
      };

/** Updates a part, snapping position and size to whole cells. Returns `doc` itself when nothing changes. */
export function patchPart(doc: Doc, id: string, patch: Partial<Part>): Doc {
  const old = doc.objects.find((p) => p.id === id);
  if (!old) return doc;
  const next: Part = { ...old, ...patch };
  if (patch.w !== undefined) next.w = Math.max(1, Math.round(next.w));
  if (patch.h !== undefined) next.h = Math.max(1, Math.round(next.h));
  if (next.x !== old.x) next.x = Math.round(next.x);
  if (next.y !== old.y) next.y = Math.round(next.y);
  const keys = Object.keys(next) as (keyof Part)[];
  if (keys.every((k) => next[k] === old[k])) return doc;
  const resized = next.w !== old.w || next.h !== old.h;
  const cables = resized
    ? doc.cables.map((c) => ({
        ...c,
        a: c.a.objId === id ? clampAnchor(c.a, next) : c.a,
        b: c.b.objId === id ? clampAnchor(c.b, next) : c.b,
      }))
    : doc.cables;
  return { objects: doc.objects.map((p) => (p.id === id ? next : p)), cables };
}

/** Parts with a name of their own: custom objects. Tiles and pieces are labelled by type. */
export const isNamed = (part: Part) => part.kind === 'object';

/** Parts the bill of materials counts: everything but custom objects, which are your own devices. */
export const isBomPart = (part: Part) => part.kind !== 'object';

/**
 * Includes parts in, or leaves them out of, the bill of materials; custom objects are skipped. Returns `doc` itself
 * when nothing changes.
 */
export function setInBom(doc: Doc, ids: string[], include: boolean): Doc {
  const targets = new Set(ids);
  let changed = false;
  const objects = doc.objects.map((p) => {
    if (!targets.has(p.id) || !isBomPart(p) || !p.noBom === include) return p;
    changed = true;
    if (!include) return { ...p, noBom: true };
    const { noBom: _, ...rest } = p;
    return rest;
  });
  return changed ? { ...doc, objects } : doc;
}

/** Removes a part; cable ends attached to it stay where they were as loose ends. */
export function removePart(doc: Doc, id: string): Doc {
  const part = doc.objects.find((p) => p.id === id);
  const release = (end: Anchor): Anchor =>
    end.objId === id && part ? { x: part.x + end.dx, y: part.y + end.dy } : end;
  return {
    objects: doc.objects.filter((p) => p.id !== id),
    cables: doc.cables.map((c) => ({ ...c, a: release(c.a), b: release(c.b) })),
  };
}

export const isDoc = (value: unknown): value is Doc =>
  !!value && Array.isArray((value as Doc).objects) && Array.isArray((value as Doc).cables);

/** Applies `edit` to one cable. Returns `doc` itself when the edit returns the cable unchanged. */
export function updateCable(doc: Doc, id: string, edit: (cable: Cable) => Cable): Doc {
  let changed = false;
  const cables = doc.cables.map((c) => {
    if (c.id !== id) return c;
    const next = edit(c);
    changed ||= next !== c;
    return next;
  });
  return changed ? { ...doc, cables } : doc;
}

/**
 * Moves a cable to `index` in the cable list, which is also the drawing order (later cables are drawn on top).
 * Returns `doc` itself when nothing moves.
 */
export function moveCable(doc: Doc, id: string, index: number): Doc {
  const from = doc.cables.findIndex((c) => c.id === id);
  const to = Math.max(0, Math.min(doc.cables.length - 1, index));
  if (from < 0 || from === to) return doc;
  const cables = [...doc.cables];
  cables.splice(to, 0, ...cables.splice(from, 1));
  return { ...doc, cables };
}

export const patchCable = (doc: Doc, id: string, patch: Partial<Cable>): Doc =>
  updateCable(doc, id, (c) => ({ ...c, ...patch }));

export const insertWaypoint = (doc: Doc, cableId: string, index: number, cell: Cell): Doc =>
  updateCable(doc, cableId, (c) => ({
    ...c,
    waypoints: [...c.waypoints.slice(0, index), cell, ...c.waypoints.slice(index)],
  }));

export const deleteWaypoint = (doc: Doc, cableId: string, index: number): Doc =>
  updateCable(doc, cableId, (c) => ({ ...c, waypoints: c.waypoints.filter((_, i) => i !== index) }));

export const moveWaypoint = (doc: Doc, cableId: string, index: number, cell: Cell): Doc =>
  updateCable(doc, cableId, (c) => {
    const current = c.waypoints[index];
    if (!current || sameCell(current, cell)) return c;
    return { ...c, waypoints: c.waypoints.map((p, i) => (i === index ? cell : p)) };
  });

/** Moves a cable end to `cell`, attaching it to the custom object there (unless objects are hidden). */
export const moveCableEnd = (doc: Doc, cableId: string, end: 'a' | 'b', cell: Cell, devicesHidden: boolean) =>
  updateCable(doc, cableId, (c) => {
    const anchor = anchorAt(doc, cell, devicesHidden);
    return sameAnchor(c[end], anchor) ? c : { ...c, [end]: anchor };
  });

/** Resizes a part so its far corner follows `cell`: straights by length, turns stay square. */
export function resizePart(doc: Doc, id: string, cell: Cell): Doc {
  const part = doc.objects.find((p) => p.id === id);
  if (!part) return doc;
  if (isLinear(part.sub)) {
    const length = isVertical(part) ? cell.y - part.y + 1 : cell.x - part.x + 1;
    return patchPart(doc, id, lengthPatch(part, Math.max(minLength(part.sub!), length)));
  }
  if (isTurn(part.sub)) {
    const n = clampTurnSize(Math.max(cell.x - part.x + 1, cell.y - part.y + 1));
    return patchPart(doc, id, { w: n, h: n });
  }
  return patchPart(doc, id, { w: Math.max(1, cell.x - part.x + 1), h: Math.max(1, cell.y - part.y + 1) });
}

export function makePiece(
  sub: PieceType,
  x: number,
  y: number,
  len = 3,
  rot = 0,
  flip = false,
  color = PIECE_COLOR,
): Part {
  const { w, h } = stampSize({ sub, len, rot });
  return {
    id: uid(),
    kind: kindOfPiece(sub),
    sub,
    name: PIECE_LABELS[sub],
    x,
    y,
    w,
    h,
    color,
    rot: rot % 4,
    flip,
  };
}

/** Places a piece with its top-left corner on `cell`. A cover replaces any cover already on that hole. */
export const placeStamp =
  (stamp: Stamp, cell: Cell) =>
  (doc: Doc): Doc => {
    const piece = makePiece(stamp.sub, cell.x, cell.y, stamp.len, stamp.rot, stamp.flip, stamp.color);
    if (piece.kind === 'cover') {
      const existing = doc.objects.find((p) => p.kind === 'cover' && p.x === cell.x && p.y === cell.y);
      if (existing) {
        if (existing.sub === stamp.sub && existing.color === stamp.color) return doc;
        const replaced = { ...existing, sub: stamp.sub, name: piece.name, color: stamp.color };
        return { ...doc, objects: doc.objects.map((p) => (p === existing ? replaced : p)) };
      }
    }
    return { ...doc, objects: [...doc.objects, piece] };
  };

/** A tile or custom object centred on `cell`. */
export const blockPart = (block: Block, cell: Cell): Part => ({
  id: uid(),
  kind: block.kind,
  name: block.name,
  x: cell.x - Math.floor(block.w / 2),
  y: cell.y - Math.floor(block.h / 2),
  w: block.w,
  h: block.h,
  color: block.color,
});

export const placeBlock =
  (block: Block, cell: Cell) =>
  (doc: Doc): Doc => ({ ...doc, objects: [...doc.objects, blockPart(block, cell)] });
