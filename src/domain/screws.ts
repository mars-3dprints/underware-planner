import { PIECE_COLOR } from './constants';
import { makePiece } from './doc';
import { uid } from './id';
import type { Cell, Doc, Part } from './types';

export const SCREW_COLOR = '#b4b8bd';
export const SCREW_LABEL = 'Screw';

/** Where a screw sits: the centre of cell (x, y), or the intersection at (x, y) where up to four tiles meet. A placed screw is one. */
export type ScrewSpot = Pick<Part, 'x' | 'y' | 'corner'>;

/** The centre or corner of the cell under `p` that is nearest to it. */
export function snapScrew(p: Cell): ScrewSpot {
  const cx = Math.floor(p.x);
  const cy = Math.floor(p.y);
  let best: ScrewSpot = { x: cx, y: cy, corner: false };
  let bestDistance = Math.hypot(p.x - (cx + 0.5), p.y - (cy + 0.5));
  for (const [x, y] of [
    [cx, cy],
    [cx + 1, cy],
    [cx, cy + 1],
    [cx + 1, cy + 1],
  ]) {
    const distance = Math.hypot(p.x - x, p.y - y);
    if (distance < bestDistance) {
      best = { x, y, corner: true };
      bestDistance = distance;
    }
  }
  return best;
}

/** The point in cell units a screw is drawn at. */
export const screwPoint = (spot: ScrewSpot): Cell =>
  spot.corner ? { x: spot.x, y: spot.y } : { x: spot.x + 0.5, y: spot.y + 0.5 };

export const sameSpot = (a: ScrewSpot, b: ScrewSpot) =>
  a.x === b.x && a.y === b.y && !!a.corner === !!b.corner;

/** Whether a screw can go on `spot`: anywhere, as long as there isn't one there already. */
export const canPlaceScrew = (doc: Doc, spot: ScrewSpot) =>
  !doc.objects.some((p) => p.kind === 'screw' && sameSpot(p, spot));

export const makeScrew = (spot: ScrewSpot, id = uid()): Part => ({
  id,
  kind: 'screw',
  name: SCREW_LABEL,
  x: spot.x,
  y: spot.y,
  // A centre screw takes its cell; an intersection screw is a point, so it never stretches a group's bounds.
  w: spot.corner ? 0 : 1,
  h: spot.corner ? 0 : 1,
  color: SCREW_COLOR,
  ...(spot.corner ? { corner: true } : {}),
});

/**
 * The wall mount snap that goes in the hole under a screw at the centre of a tile cell, or null: none for an
 * intersection, none where there is no tile, and an existing snap in that hole is left as it is.
 */
export function screwMount(doc: Doc, spot: ScrewSpot): Part | null {
  if (spot.corner) return null;
  const tiled = doc.objects.some(
    (p) => p.kind === 'plate' && p.x <= spot.x && spot.x < p.x + p.w && p.y <= spot.y && spot.y < p.y + p.h,
  );
  const taken = doc.objects.some((p) => p.kind === 'snap' && p.x === spot.x && p.y === spot.y);
  return tiled && !taken ? makePiece('wall', spot.x, spot.y, 1, 0, false, PIECE_COLOR) : null;
}

/** Puts a screw on `spot`, with its wall mount snap where one goes; nothing happens where it can't go. */
export const placeScrew =
  (spot: ScrewSpot) =>
  (doc: Doc): Doc => {
    if (!canPlaceScrew(doc, spot)) return doc;
    const mount = screwMount(doc, spot);
    return { ...doc, objects: [...doc.objects, ...(mount ? [mount] : []), makeScrew(spot)] };
  };

/** Moves a screw to `spot` (a centre or an intersection), unless another screw is already there. */
export const moveScrew =
  (id: string, spot: ScrewSpot) =>
  (doc: Doc): Doc => {
    const screw = doc.objects.find((p) => p.id === id);
    if (!screw || sameSpot(screw, spot)) return doc;
    if (doc.objects.some((p) => p.kind === 'screw' && p.id !== id && sameSpot(p, spot))) return doc;
    const moved = { ...makeScrew(spot, id), noBom: screw.noBom };
    return { ...doc, objects: doc.objects.map((p) => (p === screw ? moved : p)) };
  };
