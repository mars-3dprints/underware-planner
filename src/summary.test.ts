import { expect, it } from 'vitest';
import { fixture } from './test/fixture';
import { computeRoutes } from './route';
import { findOverlaps, summarize, summaryText, textColor } from './summary';

it('builds the bill of materials', () => {
  const d = fixture();
  const s = summarize(d, computeRoutes(d));
  expect(s).toMatchSnapshot();
  expect(summaryText(s)).toMatchSnapshot();
});

it('flags overlapping objects (channel shapes need a browser canvas)', () => {
  expect([...findOverlaps(fixture())].sort()).toEqual(['o5', 'o6']);
});

it('picks readable text colours', () => {
  expect(textColor('#ffffff')).toBe('#1b1b1b');
  expect(textColor('#343a40')).toBe('#ffffff');
});
