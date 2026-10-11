import { expect, it } from 'vitest';
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

it('flags overlapping objects (channel shapes need a browser canvas)', () => {
  expect([...findOverlaps(fixture())].sort()).toEqual(['o5', 'o6']);
});

it('picks readable text colours', () => {
  expect(readableTextColor('#ffffff')).toBe('#1b1b1b');
  expect(readableTextColor('#343a40')).toBe('#ffffff');
});
