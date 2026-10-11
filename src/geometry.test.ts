import { expect, it } from 'vitest';
import { fixture } from './test/fixture';
import { portsList, portsPath, racewayGeom } from './geometry';

it('places every channel shape with its matrix and openings', () => {
  const channels = fixture().objects.filter((o) => o.kind === 'raceway');
  expect(channels.map((o) => [o.id, racewayGeom(o), portsList(o), portsPath(o).d])).toMatchSnapshot();
});
