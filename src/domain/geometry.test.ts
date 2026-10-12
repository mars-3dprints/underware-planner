import { expect, it } from 'vitest';
import { fixture } from '../test/fixture';
import { makePiece } from './doc';
import { channelGeometry, channelPorts, worldPorts } from './geometry';

it('places every channel shape with its matrix and openings', () => {
  const channels = fixture().objects.filter((o) => o.kind === 'raceway');
  expect(channels.map((o) => [o.id, channelGeometry(o), channelPorts(o)])).toMatchSnapshot();
});

it('opens a one-sided open channel on the side its rotation faces', () => {
  // Outward directions of the side openings (the first two openings are the ends).
  const sides = (rot: number) => [
    ...new Set(
      worldPorts(makePiece('open_side', 0, 0, 2, rot))
        .slice(2)
        .map(([, , dx, dy]) => `${dx},${dy}`),
    ),
  ];
  expect([0, 1, 2, 3].map(sides)).toEqual([['0,-1'], ['1,0'], ['0,1'], ['-1,0']]);
  expect(channelPorts(makePiece('open', 0, 0, 3)).ports).toHaveLength(2 + 6);
});

it('opens an end channel at one end only, the one its rotation faces', () => {
  // Right, bottom, left, top end of a 3-cell channel at the origin.
  expect([0, 1, 2, 3].map((rot) => worldPorts(makePiece('end_round', 0, 0, 3, rot)))).toEqual([
    [[3, 0.5, 1, 0]],
    [[0.5, 3, 0, 1]],
    [[0, 0.5, -1, 0]],
    [[0.5, 0, 0, -1]],
  ]);
});
