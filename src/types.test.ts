import { describe, expect, it } from 'vitest';
import {
  ADDON_LABEL,
  ADDON_ORDER,
  counterpart,
  isVert,
  labelOf,
  lenPatch,
  pieceOf,
  portsOf,
  stampDims,
} from './types';

describe('part catalogue', () => {
  it('has a shape and openings for every channel', () => {
    const table = ADDON_ORDER.map((sub) => [sub, ADDON_LABEL[sub], pieceOf(sub, 3), portsOf(sub, 3)]);
    expect(table).toMatchSnapshot();
  });

  it('sizes stamps by length and rotation', () => {
    expect(stampDims({ sub: 'straight', len: 4, rot: 0 })).toEqual({ w: 4, h: 1 });
    expect(stampDims({ sub: 'straight', len: 4, rot: 1 })).toEqual({ w: 1, h: 4 });
    expect(stampDims({ sub: 'bridge', len: 1, rot: 0 })).toEqual({ w: 3, h: 1 });
    expect(stampDims({ sub: 'turn', len: 20, rot: 1 })).toEqual({ w: 12, h: 12 });
    expect(stampDims({ sub: 'y_round', len: 1, rot: 1 })).toEqual({ w: 3, h: 2 });
    expect(stampDims({ sub: 'hole', len: 3, rot: 0 })).toEqual({ w: 1, h: 1 });
  });

  it('pairs rounded and angled parts', () => {
    expect(counterpart('turn', 3)).toBe('angled');
    expect(counterpart('turn', 1)).toBeUndefined();
    expect(counterpart('fork_angled')).toBe('fork_round');
    expect(counterpart('t')).toBeUndefined();
    expect(counterpart(undefined)).toBeUndefined();
  });

  it('labels mirrored parts', () => {
    expect(labelOf('y_round', true)).toBe('Channel, merge/branch (rounded, mirrored)');
    expect(labelOf('straight', true)).toBe('Channel, straight (mirrored)');
    expect(labelOf('straight')).toBe('Channel, straight');
  });

  it('keeps straight orientation in step with rotation', () => {
    expect(isVert({ w: 1, h: 1, rot: 1 })).toBe(true);
    expect(isVert({ w: 1, h: 1, rot: 2 })).toBe(false);
    expect(isVert({ w: 1, h: 3 })).toBe(true);
    expect(lenPatch({ w: 1, h: 3, rot: 0 }, 5)).toEqual({ w: 1, h: 5, rot: 1 });
    expect(lenPatch({ w: 4, h: 1, rot: 2 }, 1)).toEqual({ w: 1, h: 1, rot: 2 });
  });
});
