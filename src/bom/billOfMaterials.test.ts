import { expect, it } from 'vitest';
import { makePiece } from '../domain/doc';
import { computeRoutes } from '../routing/route';
import { fixture } from '../test/fixture';
import { readableTextColor } from '../ui/color';
import { billOfMaterials, billOfMaterialsText } from './billOfMaterials';
import { findOverlaps } from './overlaps';

it('builds the bill of materials', () => {
  const d = fixture();
  const s = billOfMaterials(d, computeRoutes(d));
  expect(s).toMatchSnapshot();
  expect(billOfMaterialsText(s)).toMatchSnapshot();
});

it('leaves out excluded parts, but counts connectors joining them to included tiles', () => {
  const d = fixture();
  // o1 is a custom object, which the bill of materials never counts.
  const leftOut = new Set(['p1', 'p2', 's1', 'o1']);
  const doc = { ...d, objects: d.objects.map((p) => (leftOut.has(p.id) ? { ...p, noBom: true } : p)) };
  const full = billOfMaterials(d, computeRoutes(d));
  const s = billOfMaterials(doc, computeRoutes(doc));
  expect(s).toMatchObject({ plates: 1, tiles: 18, connectors: 6, excluded: 3 });
  expect(s.bboxMm).toEqual({ w: 6 * 28, h: 3 * 28 });
  const straights = (b: typeof s) =>
    b.channels.filter((a) => a.sub === 'straight').reduce((n, a) => n + a.qty, 0);
  expect(straights(s)).toBe(straights(full) - 1);
  expect(billOfMaterialsText(s)).toContain('Excluded parts: 3');
});

it('flags overlapping objects (channel shapes need a browser canvas)', () => {
  expect([...findOverlaps(fixture())].sort()).toEqual(['o5', 'o6']);
});

it('picks readable text colours', () => {
  expect(readableTextColor('#ffffff')).toBe('#1b1b1b');
  expect(readableTextColor('#343a40')).toBe('#ffffff');
});

it('counts a 1×1 turn as one part, whichever style', () => {
  const doc = { objects: [makePiece('turn', 0, 0, 1), makePiece('angled', 2, 0, 1)], cables: [] };
  const turns = billOfMaterials(doc, computeRoutes(doc)).channels;
  expect(turns).toHaveLength(1);
  expect(turns[0]).toMatchObject({ sub: 'turn', label: 'Channel, turn', qty: 2 });
});
