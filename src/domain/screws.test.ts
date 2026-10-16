import { describe, expect, it } from 'vitest';
import { billOfMaterials } from '../bom/billOfMaterials';
import { findOverlaps } from '../bom/overlaps';
import { routesFor } from '../routing/route';
import { rotateGroup } from './group';
import { canPlaceScrew, makeScrew, moveScrew, placeScrew, screwPoint, snapScrew } from './screws';
import type { Doc, Part } from './types';

const tile = (x: number, y: number, w: number, h: number): Part => ({
  id: `t${x}${y}`,
  kind: 'plate',
  name: 'Tile',
  x,
  y,
  w,
  h,
  color: '#b8c4bd',
});
const doc = (...objects: Part[]): Doc => ({ objects, cables: [] });

describe('snapScrew', () => {
  it('picks the centre of the cell when the pointer is near it', () => {
    expect(snapScrew({ x: 2.45, y: 3.55 })).toEqual({ x: 2, y: 3, corner: false });
  });

  it('picks the nearest corner when the pointer is near one, whichever of the four', () => {
    expect(snapScrew({ x: 2.05, y: 3.05 })).toEqual({ x: 2, y: 3, corner: true });
    expect(snapScrew({ x: 2.95, y: 3.05 })).toEqual({ x: 3, y: 3, corner: true });
    expect(snapScrew({ x: 2.05, y: 3.95 })).toEqual({ x: 2, y: 4, corner: true });
    expect(snapScrew({ x: 2.95, y: 3.95 })).toEqual({ x: 3, y: 4, corner: true });
  });

  it('gives the drawn point of a spot', () => {
    expect(screwPoint({ x: 2, y: 3, corner: false })).toEqual({ x: 2.5, y: 3.5 });
    expect(screwPoint({ x: 2, y: 3, corner: true })).toEqual({ x: 2, y: 3 });
  });
});

describe('placing screws', () => {
  it('puts a screw anywhere, tile or not, and refuses a second one on the same spot', () => {
    const tiles = doc(tile(0, 0, 2, 2));
    const spot = { x: 1, y: 0, corner: false };
    const once = placeScrew(spot)(tiles);
    expect(once.objects.filter((p) => p.kind === 'screw')).toHaveLength(1);
    expect(placeScrew(spot)(once)).toBe(once);
    expect(canPlaceScrew(once, { x: 1, y: 0, corner: true })).toBe(true);
    expect(placeScrew({ x: 9, y: 9, corner: false })(tiles).objects).toHaveLength(2);
  });

  it('turns a corner screw to the matching corner with its group', () => {
    const screw = makeScrew({ x: 0, y: 0, corner: true });
    let d = doc(tile(0, 0, 2, 2), screw);
    const ids = d.objects.map((p) => p.id);
    const corners = new Set<string>();
    for (let i = 0; i < 4; i++) {
      d = rotateGroup(d, ids);
      const s = d.objects.find((p) => p.id === screw.id)!;
      corners.add(`${s.x},${s.y}`);
    }
    // Four quarter turns visit the four corners of the 2×2 tile and end where they began.
    expect(corners.size).toBe(4);
    expect(d.objects.find((p) => p.id === screw.id)).toMatchObject({ x: 0, y: 0, corner: true });
  });
});

describe('moving a screw', () => {
  it('re-snaps between a centre and an intersection, in both directions', () => {
    const screw = makeScrew({ x: 1, y: 1, corner: false });
    const d = doc(tile(0, 0, 2, 2), screw);
    const toCorner = moveScrew(screw.id, { x: 2, y: 1, corner: true })(d);
    expect(toCorner.objects.find((p) => p.id === screw.id)).toMatchObject({
      x: 2,
      y: 1,
      w: 0,
      h: 0,
      corner: true,
    });
    const back = moveScrew(screw.id, { x: 0, y: 1, corner: false })(toCorner);
    const centre = back.objects.find((p) => p.id === screw.id)!;
    expect(centre).toMatchObject({ x: 0, y: 1, w: 1, h: 1 });
    expect(centre.corner).toBeUndefined();
  });

  it('keeps its colour and bill-of-materials flag when it moves', () => {
    const screw = { ...makeScrew({ x: 1, y: 1, corner: false }), color: '#e76f51', noBom: true };
    const d = moveScrew(screw.id, { x: 2, y: 1, corner: true })(doc(tile(0, 0, 2, 2), screw));
    expect(d.objects.find((p) => p.id === screw.id)).toMatchObject({
      color: '#e76f51',
      noBom: true,
      corner: true,
    });
  });

  it('refuses a spot another screw holds', () => {
    const a = makeScrew({ x: 0, y: 0, corner: false });
    const b = makeScrew({ x: 1, y: 0, corner: false });
    const d = doc(tile(0, 0, 2, 2), a, b);
    expect(moveScrew(a.id, { x: 1, y: 0, corner: false })(d)).toBe(d);
  });
});

describe('doubled screws', () => {
  it('flags a screw sitting on another one, but not the first', () => {
    const first = makeScrew({ x: 0, y: 0, corner: false });
    const twin = makeScrew({ x: 0, y: 0, corner: false });
    const other = makeScrew({ x: 9, y: 9, corner: false });
    expect(findOverlaps(doc(tile(0, 0, 2, 2), first, twin, other))).toEqual(new Set([twin.id]));
  });
});

describe('bill of materials', () => {
  it('lists screws of different colours on separate lines', () => {
    const red = { ...makeScrew({ x: 0, y: 0, corner: false }), color: '#e76f51' };
    const red2 = { ...makeScrew({ x: 1, y: 0, corner: false }), color: '#e76f51' };
    const silver = makeScrew({ x: 0, y: 1, corner: false });
    const d = doc(tile(0, 0, 2, 2), red, silver, red2);
    const lines = billOfMaterials(d, routesFor(d)).screws;
    expect(lines.map((l) => [l.color, l.qty])).toEqual([
      ['#b4b8bd', 1],
      ['#e76f51', 2],
    ]);
    expect(lines[1].ids).toEqual([red.id, red2.id]);
  });

  it('counts screws, and leaves out ones marked as not included', () => {
    const a = makeScrew({ x: 0, y: 0, corner: false });
    const b = makeScrew({ x: 1, y: 0, corner: false });
    const d = doc(tile(0, 0, 2, 2), a, { ...b, noBom: true });
    const bom = billOfMaterials(d, routesFor(d));
    expect(bom.screws).toEqual([{ key: a.color, color: a.color, qty: 1, ids: [a.id] }]);
    expect(bom.excluded).toBe(1);
  });
});
