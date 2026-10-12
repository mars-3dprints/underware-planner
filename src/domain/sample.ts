import { TILE_COLOR, TILE_LABEL } from './constants';
import { makePiece } from './doc';
import { uid } from './id';
import type { Cable, Doc, Part } from './types';

const tile = (x: number, y: number, rows: number, cols: number): Part => ({
  id: uid(),
  kind: 'plate',
  name: TILE_LABEL,
  x,
  y,
  w: cols,
  h: rows,
  color: TILE_COLOR,
});

const device = (name: string, x: number, y: number, w: number, h: number, color: string): Part => ({
  id: uid(),
  kind: 'object',
  name,
  x,
  y,
  w,
  h,
  color,
});

/** The layout shown on first visit. */
export function sampleDoc(): Doc {
  const tiles = [tile(0, 0, 4, 8), tile(9, 0, 4, 2), tile(0, 5, 2, 4)];
  const router = device('Router', 1, 1, 2, 1, '#4361ee');
  const network = device('Switch', 5, 1, 2, 1, '#2a9d8f');
  const nas = device('NAS', 4, 2, 1, 2, '#343a40');
  const cables: Cable[] = [
    {
      id: uid(),
      name: 'Cable 1',
      color: '#e76f51',
      a: { objId: router.id, dx: 1, dy: 0 },
      b: { objId: network.id, dx: 0, dy: 0 },
      waypoints: [],
      slackMm: 0,
    },
    {
      id: uid(),
      name: 'Cable 2',
      color: '#f4a261',
      a: { objId: network.id, dx: 1, dy: 0 },
      b: { objId: nas.id, dx: 0, dy: 1 },
      waypoints: [],
      slackMm: 0,
    },
  ];
  const pieces = [
    makePiece('hole', 0, 0),
    makePiece('wall', 7, 0),
    makePiece('hole', 7, 3),
    makePiece('wall', 0, 3),
    makePiece('straight', 9, 5, 3),
    makePiece('turn', 12, 5, 3, 1),
  ];
  return { objects: [...tiles, ...pieces, router, network, nas], cables };
}
