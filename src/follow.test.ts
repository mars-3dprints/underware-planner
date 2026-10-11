import { expect, it } from 'vitest';
import { fixture } from './test/fixture';
import { cablePathD } from './follow';
import { portsList } from './geometry';
import { routeCells } from './route';
import type { Cell, Obj } from './types';

/** Cell path that enters `o` through opening `ia` and leaves through `ib`. */
function through(o: Obj, ia: number, ib: number): Cell[] {
  const { ports, m } = portsList(o);
  const world = ports.map(([x, y, dx, dy]) => {
    const pt = { x: m![0] * x + m![2] * y + m![4], y: m![1] * x + m![3] * y + m![5] };
    const wx = Math.round(m![0] * dx + m![2] * dy), wy = Math.round(m![1] * dx + m![3] * dy);
    const cell = { x: Math.floor(pt.x - wx * 0.25), y: Math.floor(pt.y - wy * 0.25) };
    return { cell, out: { x: cell.x + wx, y: cell.y + wy } };
  });
  const a = world[ia], b = world[ib];
  return [a.out, ...routeCells(a.cell, b.cell, []), b.out];
}

it('follows the centerline of every shaped channel, in every orientation', () => {
  const shaped = fixture().objects.filter((o) => o.kind === 'raceway' && o.sub !== 'straight' && o.sub !== 'bridge');
  const out: Record<string, string> = {};
  for (const base of shaped) for (let rot = 0; rot < 4; rot++) for (const flip of [false, true]) {
    const o = { ...base, rot, flip, ...(rot % 2 !== (base.rot ?? 0) % 2 ? { w: base.h, h: base.w } : {}) };
    const n = portsList(o).ports.length;
    for (let ia = 0; ia < n; ia++) for (let ib = 0; ib < n; ib++) {
      if (ia !== ib) out[`${o.sub}${o.w === 1 && o.sub === 'turn' ? '1' : ''} r${rot}${flip ? 'f' : ''} ${ia}->${ib}`] = cablePathD(through(o, ia, ib), [o]);
    }
  }
  expect(out).toMatchSnapshot();
});

it('returns an empty path when no channel is crossed', () => {
  expect(cablePathD([{ x: 0, y: 0 }, { x: 1, y: 0 }], [])).toBe('');
});
