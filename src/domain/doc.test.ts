import { describe, expect, it } from 'vitest';
import { fixture } from '../test/fixture';
import { patchPart, placeBlock, placeStamp, removePart } from './doc';

describe('doc operations', () => {
  it('patches objects, rounding and clamping attached cable ends', () => {
    const d = fixture();
    expect(patchPart(d, 'o1', { x: 1 })).toBe(d);
    expect(patchPart(d, 'missing', { x: 4 })).toBe(d);
    const n = patchPart(d, 'o2', { w: 1.2, x: 3.6 });
    expect(n.objects.find((o) => o.id === 'o2')).toMatchObject({ x: 4, w: 1 });
    expect(n.cables.find((c) => c.id === 'k2')!.a).toEqual({ objId: 'o2', dx: 0, dy: 0 });
  });

  it('leaves loose cable ends behind when an object is removed', () => {
    const n = removePart(fixture(), 'o1');
    expect(n.objects.some((o) => o.id === 'o1')).toBe(false);
    expect(n.cables.find((c) => c.id === 'k1')!.a).toEqual({ x: 2, y: 1 });
  });

  it('stamps parts and replaces covers in place', () => {
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
    const cover = { sub: 'wall' as const, len: 1, rot: 0, flip: false, color: '#343a40' };
    const replaced = placeStamp(cover, { x: 0, y: 0 })(d);
    expect(replaced.objects).toHaveLength(d.objects.length);
    expect(replaced.objects.find((o) => o.id === 'h1')).toMatchObject({ sub: 'wall', name: 'Wall mount' });
    expect(placeStamp({ ...cover, sub: 'hole' }, { x: 0, y: 0 })(d)).toBe(d);
    const b = placeBlock(
      { kind: 'object', name: 'PC', w: 2, h: 4, color: '#fff' },
      { x: 10, y: 10 },
    )(d).objects.at(-1);
    expect(b).toMatchObject({ kind: 'object', name: 'PC', x: 9, y: 8, w: 2, h: 4 });
  });
});
