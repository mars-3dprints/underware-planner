import { describe, expect, it } from 'vitest';
import { fixture } from '../test/fixture';
import { moveCable, patchPart, placeBlock, placeStamp, removePart, setInBom } from './doc';

describe('doc operations', () => {
  it('patches objects, rounding and clamping attached cable ends', () => {
    const d = fixture();
    expect(patchPart(d, 'o1', { x: 1 })).toBe(d);
    expect(patchPart(d, 'missing', { x: 4 })).toBe(d);
    const n = patchPart(d, 'o2', { w: 1.2, x: 3.6 });
    expect(n.objects.find((o) => o.id === 'o2')).toMatchObject({ x: 4, w: 1 });
    expect(n.cables.find((c) => c.id === 'k2')!.a).toEqual({ objId: 'o2', dx: 0, dy: 0 });
  });

  it('includes parts in, and leaves them out of, the bill of materials', () => {
    const d = fixture();
    expect(setInBom(d, ['p1', 'missing'], true)).toBe(d);
    expect(setInBom(d, ['o1'], false)).toBe(d);
    const out = setInBom(d, ['p1', 's1'], false);
    expect(out.objects.filter((p) => p.noBom).map((p) => p.id)).toEqual(['p1', 's1']);
    expect(setInBom(out, ['p1'], false)).toBe(out);
    const back = setInBom(out, ['p1', 's1'], true);
    expect(back.objects).toEqual(d.objects);
    expect('noBom' in back.objects[0]).toBe(false);
  });

  it('leaves loose cable ends behind when an object is removed', () => {
    const n = removePart(fixture(), 'o1');
    expect(n.objects.some((o) => o.id === 'o1')).toBe(false);
    expect(n.cables.find((c) => c.id === 'k1')!.a).toEqual({ x: 2, y: 1 });
  });

  it('moves cables in the list, clamping the index', () => {
    const d = fixture();
    const ids = (doc: typeof d) => doc.cables.map((c) => c.id).join(' ');
    // The fixture's other cables (k6 onwards) keep their order after the moved ones.
    const rest = d.cables
      .slice(5)
      .map((c) => c.id)
      .join(' ');
    expect(ids(moveCable(d, 'k1', 2))).toBe(`k2 k3 k1 k4 k5 ${rest}`);
    expect(ids(moveCable(d, 'k5', 0))).toBe(`k5 k1 k2 k3 k4 ${rest}`);
    expect(ids(moveCable(d, 'k2', 99))).toBe(`k1 k3 k4 k5 ${rest} k2`);
    expect(moveCable(d, 'k3', 2)).toBe(d);
    expect(moveCable(d, 'missing', 0)).toBe(d);
  });

  it('stamps parts and replaces snaps in place', () => {
    const d = fixture();
    const st = { sub: 'turn' as const, len: 3, rot: 1, flip: false, color: '#000000' };
    expect(placeStamp(st, { x: 40, y: 40 })(d).objects.at(-1)).toMatchObject({
      kind: 'raceway',
      sub: 'turn',
      w: 3,
      h: 3,
      rot: 1,
      x: 40,
    });
    const snap = { sub: 'wall' as const, len: 1, rot: 0, flip: false, color: '#343a40' };
    const replaced = placeStamp(snap, { x: 0, y: 0 })(d);
    expect(replaced.objects).toHaveLength(d.objects.length);
    expect(replaced.objects.find((o) => o.id === 'h1')).toMatchObject({ sub: 'wall', name: 'Wall mount' });
    expect(placeStamp({ ...snap, sub: 'hole' }, { x: 0, y: 0 })(d)).toBe(d);
    const b = placeBlock(
      { kind: 'object', name: 'PC', w: 2, h: 4, color: '#fff' },
      { x: 10, y: 10 },
    )(d).objects.at(-1);
    expect(b).toMatchObject({ kind: 'object', name: 'PC', x: 9, y: 8, w: 2, h: 4 });
  });
});
