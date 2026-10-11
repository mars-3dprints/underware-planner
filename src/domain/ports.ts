import { isTurn } from './pieces';
import type { PieceType } from './types';

/** An opening of a channel: position on its edge and outward direction, in the piece's own frame. */
export type Port = [x: number, y: number, dx: number, dy: number];

/** Openings of a shaped piece of size `n` (turns), in the piece's own frame. */
export function piecePorts(type: PieceType, n: number): Port[] {
  if (isTurn(type)) {
    return [
      [0, 0.5, -1, 0],
      [n - 0.5, n, 0, 1],
    ];
  }
  switch (type) {
    case 'y_round':
    case 'y_angled':
      return [
        [0.5, 0, 0, -1],
        [1.5, 0, 0, -1],
        [1.5, 3, 0, 1],
      ];
    case 'jog_round':
    case 'jog_angled':
      return [
        [0.5, 0, 0, -1],
        [1.5, 3, 0, 1],
      ];
    case 't':
      return [
        [0.5, 0, 0, -1],
        [0.5, 3, 0, 1],
        [2, 1.5, 1, 0],
      ];
    case 'cross1':
      return [
        [0.5, 0, 0, -1],
        [1, 0.5, 1, 0],
        [0.5, 1, 0, 1],
        [0, 0.5, -1, 0],
      ];
    case 'cross':
      return [
        [1.5, 0, 0, -1],
        [3, 1.5, 1, 0],
        [1.5, 3, 0, 1],
        [0, 1.5, -1, 0],
      ];
    case 'fork_round':
    case 'fork_angled':
      return [
        [0, 0.5, -1, 0],
        [0, 2.5, -1, 0],
        [3, 1.5, 1, 0],
      ];
    case 'cap':
      return [
        [0, 0.5, -1, 0],
        [1.5, 1, 0, 1],
      ];
    default:
      return [];
  }
}

/** Point `along` inward and `across` sideways from an opening, as an SVG coordinate pair. */
function fromPort([x, y, dx, dy]: Port, along: number, across: number) {
  return `${+(x - dx * along - dy * across).toFixed(3)} ${+(y - dy * along + dx * across).toFixed(3)}`;
}

/** Small rectangles just inside each opening, used to keep the ends of an inset channel flush. */
export const openingsMaskPath = (ports: Port[], depth: number, half: number) =>
  ports
    .map((port) => {
      const at = (along: number, across: number) => fromPort(port, along, across);
      return `M${at(-0.02, -half)}L${at(depth, -half)}L${at(depth, half)}L${at(-0.02, half)}Z`;
    })
    .join('');
