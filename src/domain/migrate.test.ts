import { expect, it } from 'vitest';
import { fixture } from '../test/fixture';
import { readLayout } from './migrate';

it('reads layouts from saves and exported files, migrating old ones', () => {
  const old = {
    objects: [{ id: 'a', kind: 'plate', name: 'Plate', x: 0, y: 0, w: 2, h: 2, color: '#fff' }],
    cables: [],
  };
  expect(readLayout(old)!.objects[0].name).toBe('Tile');
  expect(readLayout(fixture())).toEqual(fixture());
  expect(readLayout({ objects: [] })).toBeNull();
  expect(readLayout(undefined)).toBeNull();
});
