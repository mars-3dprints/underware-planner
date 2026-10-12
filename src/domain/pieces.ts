import { MAX_TURN_SIZE } from './constants';
import type { PartKind, PieceType } from './types';

/**
 * Outline of a piece in its own frame: cell units, unrotated, channel width one cell.
 * `sep` is the divider drawn between merged channels.
 */
export interface PieceShape {
  label: string;
  w: number;
  h: number;
  d: string;
  sep?: string;
}

/** Octagonal hole of an openGrid tile, in a unit cell. */
export const TILE_HOLE_PATH = 'M.36 .2H.64L.8 .36V.64L.64 .8H.36L.2 .64V.36Z';

const roundedTurnPath = (n: number) =>
  `M0 0H1A${n - 1} ${n - 1} 0 0 1 ${n} ${n - 1}V${n}H${n - 1}V${n - 1}${n > 2 ? `A${n - 2} ${n - 2} 0 0 0 1 1` : ''}H0Z`;
const angledTurnPath = (n: number) => `M0 0H1L${n} ${n - 1}V${n}H${n - 1}V${n - 1}L1 1H0Z`;

/** Fixed-size channel pieces. Straights, bridges and turns are sized by length instead. */
export const PIECE_SHAPES: Partial<Record<PieceType, PieceShape>> = {
  y_round: {
    label: 'Channel, merge/branch (rounded)',
    w: 2,
    h: 3,
    d: 'M0 0H2V3H1V2A1 1 0 0 1 0 1Z',
    sep: 'M1 0V1',
  },
  y_angled: { label: 'Channel, merge/branch (angled)', w: 2, h: 3, d: 'M0 0H2V3H1V2L0 1Z', sep: 'M1 0V1' },
  jog_round: {
    label: 'Channel, offset (rounded)',
    w: 2,
    h: 3,
    d: 'M0 0V1A1 1 0 0 0 1 2V3H2V2A1 1 0 0 0 1 1V0Z',
  },
  jog_angled: {
    label: 'Channel, offset (angled)',
    w: 2,
    h: 3,
    d: 'M0 0V1.208L1 2.208V3H2V1.792L1 .792V0Z',
  },
  t: { label: 'Channel, 3-way junction', w: 2, h: 3, d: 'M0 0H1V1H2V2H1V3H0Z' },
  cross1: { label: 'Channel, 4-way junction (1×1)', w: 1, h: 1, d: 'M0 0H1V1H0Z' },
  cross: { label: 'Channel, 4-way junction', w: 3, h: 3, d: 'M1 0H2V1H3V2H2V3H1V2H0V1H1Z' },
  // Inline junctions: a straight run with openings flush in its side walls, no arms.
  t_inline: { label: 'Channel, 3-way junction (inline)', w: 3, h: 1, d: 'M0 0H3V1H0Z' },
  cross_inline: { label: 'Channel, 4-way junction (inline)', w: 3, h: 1, d: 'M0 0H3V1H0Z' },
  t_end: { label: 'Channel, 3-way junction (end)', w: 2, h: 1, d: 'M0 0H2V1H0Z' },
  fork_round: {
    label: 'Channel, fork (rounded)',
    w: 3,
    h: 3,
    d: 'M0 0H1A1 1 0 0 1 2 1H3V2H2A1 1 0 0 1 1 3H0V2H1V1H0Z',
  },
  fork_angled: { label: 'Channel, fork (angled)', w: 3, h: 3, d: 'M0 0H1L2 1H3V2H2L1 3H0V2H1V1H0Z' },
  cap: { label: 'Channel, short turn', w: 2, h: 1, d: 'M0 0H1A1 1 0 0 1 2 1H0Z' },
};

const CHANNEL_TYPES: PieceType[] = [
  'straight',
  'bridge',
  'turn',
  'angled',
  'y_round',
  'y_angled',
  'jog_round',
  'jog_angled',
  't',
  'cross1',
  'cross',
  't_inline',
  'cross_inline',
  't_end',
  'fork_round',
  'fork_angled',
  'cap',
];
export const COVER_TYPES: PieceType[] = ['hole', 'wall'];
/** Catalogue order, used to sort the bill of materials. */
export const PIECE_ORDER: PieceType[] = [...CHANNEL_TYPES, ...COVER_TYPES];

export const PIECE_LABELS = {
  straight: 'Channel, straight',
  bridge: 'Channel, bridge',
  turn: 'Channel, turn (rounded)',
  angled: 'Channel, turn (angled)',
  hole: 'Tile cover',
  wall: 'Wall mount',
  ...Object.fromEntries(Object.entries(PIECE_SHAPES).map(([type, shape]) => [type, shape.label])),
} as Record<PieceType, string>;

/** Pieces whose mirror image is a different part to print (rotating never changes this, flipping does). */
const CHIRAL_PIECES: PieceType[] = ['y_round', 'y_angled', 'jog_round', 'jog_angled', 'cap'];

const COUNTERPARTS: Partial<Record<PieceType, PieceType>> = {
  turn: 'angled',
  angled: 'turn',
  y_round: 'y_angled',
  y_angled: 'y_round',
  jog_round: 'jog_angled',
  jog_angled: 'jog_round',
  fork_round: 'fork_angled',
  fork_angled: 'fork_round',
};

export const kindOfPiece = (type: PieceType): PartKind => (COVER_TYPES.includes(type) ? 'cover' : 'raceway');
export const isTurn = (type?: PieceType) => type === 'turn' || type === 'angled';
/** Straights and bridges: sized by length, orientation from their footprint. */
export const isLinear = (type?: PieceType) => type === 'straight' || type === 'bridge';
/** Pieces drawn from a shape (turns and fixed-size pieces), which can be flipped. */
export const isShaped = (type?: PieceType) => isTurn(type) || (!!type && !!PIECE_SHAPES[type]);
/**
 * Mirror a shaped piece left to right on screen. `flip` mirrors the piece in its own frame, which is top to bottom
 * when it is turned a quarter, so a sideways piece also turns half way round. The footprint doesn't change.
 */
export const flipped = ({ rot = 0, flip = false }: { rot?: number; flip?: boolean }) => ({
  flip: !flip,
  rot: rot % 2 ? (rot + 2) % 4 : rot,
});
/** Turn size kept within 1 to `MAX_TURN_SIZE` cells. */
export const clampTurnSize = (n: number) => Math.max(1, Math.min(MAX_TURN_SIZE, n));
export const minLength = (type: PieceType) => (type === 'bridge' ? 3 : 1);

/** Rounded <-> angled counterpart with the same size and openings, if there is one. A 1×1 turn has none. */
export const counterpart = (type?: PieceType, size = 2): PieceType | undefined =>
  type && !(type === 'turn' && size < 2) ? COUNTERPARTS[type] : undefined;

/** Shape of a piece; turns are `size` × `size` cells, every other piece has a fixed size. */
export function pieceShape(type: PieceType, size = 2): PieceShape | undefined {
  if (!isTurn(type)) return PIECE_SHAPES[type];
  const n = clampTurnSize(size);
  const d = n === 1 ? 'M0 0H1V1H0Z' : type === 'turn' ? roundedTurnPath(n) : angledTurnPath(n);
  return { label: PIECE_LABELS[type], w: n, h: n, d };
}

export const isMirrored = (piece: { sub?: PieceType; flip?: boolean }) =>
  !!piece.flip && !!piece.sub && CHIRAL_PIECES.includes(piece.sub);

export function pieceLabel(type: PieceType, mirrored = false) {
  const label = PIECE_LABELS[type];
  if (!mirrored) return label;
  return label.endsWith(')') ? label.slice(0, -1) + ', mirrored)' : label + ' (mirrored)';
}

/** Footprint, in cells, of a piece placed with a given length and quarter-turn count. */
export function stampSize(stamp: { sub: PieceType; len: number; rot: number }) {
  const { sub, len, rot } = stamp;
  if (isLinear(sub)) {
    const length = Math.max(minLength(sub), len);
    return rot % 2 === 0 ? { w: length, h: 1 } : { w: 1, h: length };
  }
  if (isTurn(sub)) {
    const n = clampTurnSize(len);
    return { w: n, h: n };
  }
  const shape = PIECE_SHAPES[sub];
  if (!shape) return { w: 1, h: 1 };
  return rot % 2 === 0 ? { w: shape.w, h: shape.h } : { w: shape.h, h: shape.w };
}

type Footprint = { w: number; h: number; rot?: number };

/** Orientation of a straight channel: from its footprint, or (when 1×1) from the parity of `rot`. */
export const isVertical = (part: Footprint) =>
  part.w === part.h ? (part.rot ?? 0) % 2 === 1 : part.h > part.w;

/** Patch that sets a straight channel's length, keeping its orientation and `rot` parity in step. */
export function lengthPatch(part: Footprint, length: number) {
  const vertical = isVertical(part);
  const rot = part.rot ?? 0;
  return {
    w: vertical ? 1 : length,
    h: vertical ? length : 1,
    rot: (rot % 2 === (vertical ? 1 : 0) ? rot : rot + 1) % 4,
  };
}
