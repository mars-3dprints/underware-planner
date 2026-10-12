import { describe, expect, it } from 'vitest';
import { computeRoutes } from '../routing/route';
import { fixture } from '../test/fixture';
import {
  attachedCables,
  boundsOf,
  drawnBounds,
  carriedCables,
  cloneItems,
  internalCables,
  moveGroup,
  pinCables,
  rotateGroup,
  selectionBounds,
} from './group';

const ids = (xs: { id: string }[]) => xs.map((x) => x.id);

describe('group helpers', () => {
  it('measures bounds', () => {
    const d = fixture();
    expect(boundsOf(d.objects.filter((o) => o.kind === 'plate'))).toEqual({ x: 0, y: 0, w: 16, h: 11 });
    expect(
      selectionBounds(
        [],
        d.cables.filter((c) => c.id === 'k6'),
      ),
    ).toEqual({ x: 2, y: 17, w: 11, h: 4 });
  });

  it('measures the drawn selection, including attached cable ends', () => {
    const d = fixture();
    const cables = d.cables.filter((c) => c.id === 'k1' || c.id === 'k2');
    // Router's port (2, 1) to NAS's (14, 6); the movable points alone are just k2's waypoint.
    expect(drawnBounds([], cables, computeRoutes(d))).toEqual({ x: 2, y: 1, w: 13, h: 6 });
    expect(selectionBounds([], cables)).toEqual({ x: 10, y: 3, w: 1, h: 1 });
  });

  it('finds cables that travel with a selection', () => {
    const d = fixture();
    expect(ids(internalCables(d.cables, new Set(['o1', 'o2'])))).toEqual(['k1']);
    expect(ids(attachedCables(d.cables, new Set(['o2'])))).toEqual(['k1', 'k2']);
    expect(ids(attachedCables(d.cables, new Set(['o4'])))).toEqual([]);
    expect(ids(carriedCables(d.cables, new Set(['o1', 'o2']), new Set(['k6'])))).toEqual(['k1', 'k6']);
  });

  it('moves objects with their internal cables', () => {
    const d = fixture();
    expect(moveGroup(d, ['o1'], [], 0, 0)).toBe(d);
    const moved = moveGroup(d, ['o2', 'o3'], ['k3'], 2, -1);
    expect(moved.objects.find((o) => o.id === 'o2')).toMatchObject({ x: 9, y: 0 });
    expect(moved.cables.find((c) => c.id === 'k2')!.waypoints).toEqual([{ x: 12, y: 2 }]);
    expect(moved.cables.find((c) => c.id === 'k3')!.a).toEqual({ x: 13, y: 0 });
    expect(moved.cables.find((c) => c.id === 'k1')).toBe(d.cables.find((c) => c.id === 'k1'));
  });

  it('rotates groups a quarter turn', () => {
    const d = fixture();
    expect(rotateGroup(d, ['o1', 'o2', 's1', 't1', 'y1'], ['k6'])).toMatchSnapshot();
  });

  it('moves selected cables as they are drawn, routing again only to an end left behind', () => {
    const d = fixture();
    const before = computeRoutes(d).get('k2')!.draw;
    // k2 runs from the Switch (o2, moving) to the NAS (o3, staying put): all but its last bend shift with it.
    const moved = moveGroup(pinCables(d, ['k2'], ['o2'], computeRoutes(d)), ['o2'], ['k2'], 0, 3);
    const after = computeRoutes(moved).get('k2')!.draw;
    const shifted = before.slice(0, -2).map((c) => ({ x: c.x, y: c.y + 3 }));
    expect(after.slice(0, shifted.length)).toEqual(shifted);
    expect(after.at(-1)).toEqual(before.at(-1));
    // A cable moved on its own isn't pinned.
    expect(pinCables(d, ['k2'], [], computeRoutes(d))).toBe(d);
    // Pinning a cable already pinned to its path changes nothing.
    const pinned = pinCables(d, ['k2'], ['o2', 'o3'], computeRoutes(d));
    expect(pinCables(pinned, ['k2'], ['o2', 'o3'], computeRoutes(pinned))).toBe(pinned);
  });

  it('turns snaps in place, so slots and notches face the new way', () => {
    const d = fixture();
    const turned = rotateGroup(d, ['h5']).objects.find((o) => o.id === 'h5')!;
    expect(turned).toMatchObject({ x: 9, y: 0, w: 1, h: 1, rot: 1 });
  });

  it('rotates cables alone around their attached ends, back to the start after four turns', () => {
    const d = fixture();
    let r = d;
    for (let i = 0; i < 4; i++) r = rotateGroup(r, [], ['k2']);
    expect(r.cables).toEqual(d.cables);
    let loose = d;
    const once = rotateGroup(d, [], ['k6']);
    expect(once.cables.find((c) => c.id === 'k6')).toMatchSnapshot();
    for (let i = 0; i < 4; i++) loose = rotateGroup(loose, [], ['k6']);
    expect(loose.cables.find((c) => c.id === 'k6')).toEqual(d.cables.find((c) => c.id === 'k6'));
    expect(rotateGroup(d, [], ['k1'])).toBe(d);
  });

  it('clones with fresh ids and remapped anchors', () => {
    const d = fixture();
    const objs = d.objects.filter((o) => o.id === 'o1' || o.id === 'o2');
    const c = cloneItems(
      objs,
      d.cables.filter((x) => x.id === 'k1' || x.id === 'k6'),
      1,
      2,
    );
    expect(c.parts.map((o) => [o.x, o.y])).toEqual([
      [2, 3],
      [8, 3],
    ]);
    expect(new Set(ids(c.parts)).has('o1')).toBe(false);
    expect(c.cables[0].a).toEqual({ objId: c.parts[0].id, dx: 1, dy: 0 });
    expect(c.cables[1].a).toEqual({ x: 3, y: 20 });
    expect(c.cables[1].waypoints[0]).toEqual({ x: 7, y: 22 });
  });
});
