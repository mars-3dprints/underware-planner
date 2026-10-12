import { describe, expect, it } from 'vitest';
import { cableRoute, partsById } from './anchors';
import type { Cable, Part } from './types';

const device = (id: string, name: string) => ({ id, kind: 'object', name }) as Part;
const cable = (a: Cable['a'], b: Cable['b']): Cable => ({
  id: 'k',
  name: 'Cable 1',
  color: '#000',
  a,
  b,
  waypoints: [],
  slackMm: 0,
});
const parts = partsById([device('r', 'Router'), device('n', 'NAS'), device('x', '  ')]);

describe('cableRoute', () => {
  it('joins the two attached objects', () => {
    expect(cableRoute(cable({ objId: 'r', dx: 0, dy: 0 }, { objId: 'n', dx: 0, dy: 0 }), parts)).toBe(
      'Router ↔ NAS',
    );
  });
  it('marks a loose end', () => {
    expect(cableRoute(cable({ objId: 'r', dx: 0, dy: 0 }, { x: 1, y: 1 }), parts)).toBe('Router ↔ loose end');
  });
  it('calls a cable with both ends loose a loose cable', () => {
    expect(cableRoute(cable({ x: 0, y: 0 }, { x: 1, y: 1 }), parts)).toBe('Loose cable');
  });
  it('falls back for unnamed or missing objects', () => {
    expect(cableRoute(cable({ objId: 'x', dx: 0, dy: 0 }, { objId: 'gone', dx: 0, dy: 0 }), parts)).toBe(
      'Device ↔ loose end',
    );
  });
});
