import { describe, expect, it } from 'vitest';
import { anchorCell } from '../domain/anchors';
import { fixture } from '../test/fixture';
import { computeRoutes, routeCells, simplify } from './route';

describe('routeCells', () => {
  it('runs straight when nothing is in the way', () => {
    expect(routeCells({ x: 0, y: 0 }, { x: 3, y: 0 }, [])).toEqual([0, 1, 2, 3].map((x) => ({ x, y: 0 })));
  });

  it('returns a single cell for the same start and end', () => {
    expect(routeCells({ x: 2, y: 2 }, { x: 2, y: 2 }, [])).toEqual([{ x: 2, y: 2 }]);
  });

  it('goes around obstacles', () => {
    const path = routeCells({ x: 0, y: 0 }, { x: 4, y: 0 }, [{ x: 2, y: -1, w: 1, h: 2 }]);
    expect(path.some((p) => p.x === 2 && p.y <= 0)).toBe(false);
    expect(path[0]).toEqual({ x: 0, y: 0 });
    expect(path[path.length - 1]).toEqual({ x: 4, y: 0 });
  });

  it('falls back to an L route when boxed in', () => {
    const wall = { x: -20, y: 1, w: 40, h: 1 };
    expect(routeCells({ x: 0, y: 0 }, { x: 1, y: 2 }, [wall, { x: -20, y: -1, w: 40, h: 1 }], 1)).toEqual([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 1, y: 2 },
    ]);
  });
});

describe('simplify', () => {
  it('keeps bends and U-turns only', () => {
    const pts = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 2, y: 1 },
      { x: 2, y: 2 },
    ];
    expect(simplify(pts)).toEqual([
      { x: 0, y: 0 },
      { x: 2, y: 0 },
      { x: 2, y: 2 },
    ]);
    expect(
      simplify([
        { x: 0, y: 0 },
        { x: 2, y: 0 },
        { x: 1, y: 0 },
      ]),
    ).toHaveLength(3);
  });
});

describe('computeRoutes', () => {
  it('resolves anchors', () => {
    const byId = new Map(fixture().objects.map((o) => [o.id, o]));
    expect(anchorCell({ objId: 'o1', dx: 1, dy: 0 }, byId)).toEqual({ x: 2, y: 1 });
    expect(anchorCell({ x: 3, y: 4 }, byId)).toEqual({ x: 3, y: 4 });
    expect(anchorCell({ objId: 'gone', dx: 0, dy: 0 }, byId)).toBeNull();
  });

  it('routes every cable in the fixture', () => {
    expect(Object.fromEntries(computeRoutes(fixture()))).toMatchSnapshot();
  });
});
