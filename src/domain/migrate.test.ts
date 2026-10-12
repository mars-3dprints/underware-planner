import { expect, it } from 'vitest';
import { fixture } from '../test/fixture';
import { readLayout } from './migrate';

it('reads layouts from saves and exported files, migrating old ones', () => {
  const old = {
    objects: [{ id: 'a', kind: 'plate', name: 'Plate', x: 0, y: 0, w: 2, h: 2, color: '#fff' }],
    cables: [],
  };
  expect(readLayout(old)!.objects[0].name).toBe('Tile');
  const device = { id: 'o', kind: 'object', name: 'NAS', x: 0, y: 0, w: 1, h: 1, color: '#fff', noBom: true };
  expect(readLayout({ objects: [device], cables: [] })!.objects[0]).not.toHaveProperty('noBom');
  expect(readLayout(fixture())).toEqual(fixture());
  const stale = {
    objects: [
      { id: 'k', kind: 'raceway', sub: 'straight', name: 'x', x: 0, y: 0, w: 2, h: 1, color: '#000' },
      { id: 'c', kind: 'cover', sub: 'hole', name: 'Tile cover', x: 0, y: 0, w: 1, h: 1, color: '#000' },
      { id: 'i', kind: 'raceway', sub: 'removed_type', name: 'x', x: 0, y: 0, w: 3, h: 1, color: '#000' },
    ],
    cables: [],
  };
  expect(readLayout(stale)!.objects.map((o) => o.id)).toEqual(['k']);
  expect(readLayout({ objects: [] })).toBeNull();
  expect(readLayout(undefined)).toBeNull();
});
