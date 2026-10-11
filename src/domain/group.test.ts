import { describe, expect, it } from 'vitest';
import { fixture } from '../test/fixture';
import {
  boundsOf,
  carriedCables,
  cloneItems,
  internalCables,
  moveGroup,
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

  it('finds cables that travel with a selection', () => {
    const d = fixture();
    expect(ids(internalCables(d.cables, new Set(['o1', 'o2'])))).toEqual(['k1']);
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
