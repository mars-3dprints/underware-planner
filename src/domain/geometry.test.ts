import { expect, it } from 'vitest';
import { fixture } from '../test/fixture';
import { channelGeometry, channelPorts } from './geometry';

it('places every channel shape with its matrix and openings', () => {
  const channels = fixture().objects.filter((o) => o.kind === 'raceway');
  expect(channels.map((o) => [o.id, channelGeometry(o), channelPorts(o)])).toMatchSnapshot();
});
