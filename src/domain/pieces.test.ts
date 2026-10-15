import { describe, expect, it } from 'vitest';
import {
  raisedSpan,
  channelLabel,
  counterpart,
  flipped,
  isMirrored,
  isShaped,
  isVertical,
  lengthPatch,
  PIECE_LABELS,
  PIECE_ORDER,
  pieceLabel,
  pieceShape,
  stampSize,
} from './pieces';
import { piecePorts } from './ports';
import type { Part } from './types';
import { makePiece } from './doc';
import { shapedChannels } from '../routing/follow';
import { applyMatrix, channelGeometry } from './geometry';

describe('part catalogue', () => {
  it('has a shape and openings for every channel', () => {
    const table = PIECE_ORDER.map((sub) => [sub, PIECE_LABELS[sub], pieceShape(sub, 3), piecePorts(sub, 3)]);
    expect(table).toMatchSnapshot();
  });

  it('sizes stamps by length and rotation', () => {
    expect(stampSize({ sub: 'straight', len: 4, rot: 0 })).toEqual({ w: 4, h: 1 });
    expect(stampSize({ sub: 'straight', len: 4, rot: 1 })).toEqual({ w: 1, h: 4 });
    expect(stampSize({ sub: 'bridge', len: 1, rot: 0 })).toEqual({ w: 3, h: 1 });
    expect(stampSize({ sub: 'turn', len: 20, rot: 1 })).toEqual({ w: 12, h: 12 });
    expect(stampSize({ sub: 'y_round', len: 1, rot: 1 })).toEqual({ w: 3, h: 2 });
    expect(stampSize({ sub: 'channel_grip', len: 3, rot: 0 })).toEqual({ w: 1, h: 1 });
  });

  it('pairs rounded and angled parts', () => {
    expect(counterpart('turn', 3)).toBe('angled');
    expect(counterpart('turn', 1)).toBeUndefined();
    expect(counterpart('fork_angled')).toBe('fork_round');
    expect(counterpart('t')).toBeUndefined();
    expect(counterpart(undefined)).toBeUndefined();
  });

  it('labels mirrored parts', () => {
    expect(pieceLabel('y_round', { mirrored: true })).toBe('Channel, merge/branch (rounded, mirrored)');
    expect(pieceLabel('straight', { mirrored: true })).toBe('Channel, straight (mirrored)');
    expect(pieceLabel('straight')).toBe('Channel, straight');
    expect(pieceLabel('angled', { size: 1 })).toBe('Channel, turn');
    expect(pieceLabel('angled', { size: 2 })).toBe('Channel, turn (angled)');
    expect(channelLabel('Channel, 3-way junction (inline)')).toBe('3-way junction (inline)');
    expect(channelLabel('Channel, turn (rounded)')).toBe('Turn (rounded)');
    expect(channelLabel('Channel grip snap')).toBe('Channel grip snap');
  });

  it('keeps straight orientation in step with rotation', () => {
    expect(isVertical({ w: 1, h: 1, rot: 1 })).toBe(true);
    expect(isVertical({ w: 1, h: 1, rot: 2 })).toBe(false);
    expect(isVertical({ w: 1, h: 3 })).toBe(true);
    expect(lengthPatch({ w: 1, h: 3, rot: 0 }, 5)).toEqual({ w: 1, h: 5, rot: 1 });
    expect(lengthPatch({ w: 4, h: 1, rot: 2 }, 1)).toEqual({ w: 1, h: 1, rot: 2 });
  });
});

describe('bridges', () => {
  it("raises the span between the ramps, or from a half bridge's ramp to its far end", () => {
    expect(raisedSpan('bridge', 4)).toEqual([1, 3]);
    expect(raisedSpan('half_bridge', 4)).toEqual([1, 4]);
    expect(raisedSpan('straight', 4)).toBeNull();
  });
});

describe('flipping', () => {
  it('treats exactly the pieces that rotating cannot reproduce as chiral', () => {
    // World openings, relative to the footprint.
    const openings = (p: Part) =>
      shapedChannels([p])[0]
        .ports.map(({ point, dx, dy }) => [point.x.toFixed(3), point.y.toFixed(3), dx, dy].join())
        .sort()
        .join(' ');
    for (const sub of PIECE_ORDER.filter(isShaped)) {
      const mirror = openings(makePiece(sub, 0, 0, 3, 0, true));
      const byRotating = [0, 1, 2, 3].some((rot) => openings(makePiece(sub, 0, 0, 3, rot)) === mirror);
      expect(isMirrored({ sub, flip: true }), sub).toBe(!byRotating);
    }
  });

  it('mirrors every shaped piece left to right on screen, whatever its rotation', () => {
    for (const sub of PIECE_ORDER.filter(isShaped)) {
      for (let rot = 0; rot < 4; rot++) {
        const piece = makePiece(sub, 0, 0, 3, rot);
        const turned = { ...piece, ...flipped(piece) };
        expect([turned.w, turned.h]).toEqual([piece.w, piece.h]);
        // Each point of the shape lands mirrored across the footprint's vertical centre line.
        for (const [x, y] of [
          [0, 0],
          [1, 0],
          [0, 1],
        ]) {
          const before = applyMatrix(channelGeometry(piece).m!, x, y);
          const after = applyMatrix(channelGeometry(turned).m!, x, y);
          expect(after.x, `${sub} rot ${rot}`).toBeCloseTo(piece.w - before.x);
          expect(after.y, `${sub} rot ${rot}`).toBeCloseTo(before.y);
        }
      }
    }
  });
});
