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

/** Circle of radius `r` centred in a unit cell, as path data. */
const circlePath = (r: number) => `M${0.5 - r} .5a${r} ${r} 0 1 0 ${r * 2} 0a${r} ${r} 0 1 0 ${-r * 2} 0Z`;

const roundedTurnPath = (n: number) =>
  `M0 0H1A${n - 1} ${n - 1} 0 0 1 ${n} ${n - 1}V${n}H${n - 1}V${n - 1}${n > 2 ? `A${n - 2} ${n - 2} 0 0 0 1 1` : ''}H0Z`;
const angledTurnPath = (n: number) => `M0 0H1L${n} ${n - 1}V${n}H${n - 1}V${n - 1}L1 1H0Z`;

/** Fixed-size channel pieces. Straights, bridges, open and end channels, and turns are sized by length instead. */
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

/** Channels by family, in the order the library and the bill of materials list them. */
export const CHANNEL_FAMILIES: { title: string; types: PieceType[] }[] = [
  { title: 'Straight', types: ['straight', 'bridge', 'open', 'open_side', 'end_round', 'end_angled'] },
  { title: 'Turns', types: ['turn', 'angled', 'cap'] },
  { title: 'Merge and branch', types: ['y_round', 'y_angled'] },
  {
    title: 'Junctions',
    types: ['t', 'cross', 't_inline', 'cross_inline', 't_end', 'fork_round', 'fork_angled'],
  },
  { title: 'Offsets', types: ['jog_round', 'jog_angled'] },
];
const CHANNEL_TYPES = CHANNEL_FAMILIES.flatMap((family) => family.types);
/** Gap from a snap's edge to its cell's, and how much its octagon cuts off each corner, in cells. */
const SNAP_GAP = 0.07;
const SNAP_CORNER = 0.2;
/** Depth of the base snap's notches; inset and width of the grip snap's slots. */
const NOTCH_DEPTH = 0.12;
const SLOT_INSET = 0.07;
const SLOT_WIDTH = 0.05;

/** A snap's octagon, covering most of its cell; `notched` cuts a notch into the middle of the top and bottom. */
function snapOctagon(notched = false) {
  const [a, b, c, d] = [SNAP_GAP, SNAP_GAP + SNAP_CORNER, 1 - SNAP_GAP - SNAP_CORNER, 1 - SNAP_GAP];
  const top = notched ? `H.4V${a + NOTCH_DEPTH}H.6V${a}` : '';
  const bottom = notched ? `H.6V${d - NOTCH_DEPTH}H.4V${d}` : '';
  return `M${b} ${a}${top}H${c}L${d} ${b}V${c}L${c} ${d}${bottom}H${b}L${a} ${c}V${b}Z`;
}

/** Slot running down the middle of the cell, its left edge at `x`. */
const slot = (x: number) => `M${x} .3H${x + SLOT_WIDTH}V.7H${x}Z`;

/**
 * How a snap looks from above, in its cell: `d` is its outline with any cut-outs (draw with even-odd fill),
 * `thread` the radius of a threaded hole, `stub` the radius of a threaded stub standing up from it.
 * `turns` is how many quarter turns look different: 2 for snaps that differ side to side, else 1.
 */
export interface SnapShape {
  label: string;
  d: string;
  turns: 1 | 2;
  thread?: number;
  stub?: number;
}

/** Snaps, in catalogue order. */
export const SNAP_SHAPES: Partial<Record<PieceType, SnapShape>> = {
  // Slots along two sides make the edges flex, for easier snapping.
  channel_grip: {
    label: 'Channel grip snap',
    d: snapOctagon() + slot(SNAP_GAP + SLOT_INSET) + slot(1 - SNAP_GAP - SLOT_INSET - SLOT_WIDTH),
    turns: 2,
  },
  // A notch through the middle, for zip ties.
  channel_base: { label: 'Channel base snap', d: snapOctagon(true), turns: 2 },
  wall: { label: 'Wall mount', d: snapOctagon() + circlePath(0.085), turns: 1 },
  multiconnect: { label: 'Multiconnect', d: snapOctagon() + circlePath(0.2), turns: 1, thread: 0.2 },
  base_compat: { label: 'Base compatibility snap', d: snapOctagon(), turns: 1, stub: 0.12 },
};
export const SNAP_TYPES = Object.keys(SNAP_SHAPES) as PieceType[];

/** A piece's quarter turns, kept to those that look different (a symmetric snap has one). */
export const pieceRot = (sub: PieceType, rot: number) => rot % (SNAP_SHAPES[sub]?.turns ?? 4);
/** Catalogue order, used to sort the bill of materials. */
export const PIECE_ORDER: PieceType[] = [...CHANNEL_TYPES, ...SNAP_TYPES];

export const PIECE_LABELS = {
  straight: 'Channel, straight',
  bridge: 'Channel, bridge',
  open: 'Open channel',
  open_side: 'Open channel (one side)',
  end_round: 'End channel (rounded)',
  end_angled: 'End channel (angled)',
  turn: 'Channel, turn (rounded)',
  angled: 'Channel, turn (angled)',
  ...Object.fromEntries(Object.entries(PIECE_SHAPES).map(([type, shape]) => [type, shape.label])),
  ...Object.fromEntries(Object.entries(SNAP_SHAPES).map(([type, shape]) => [type, shape.label])),
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
  end_round: 'end_angled',
  end_angled: 'end_round',
};

export const kindOfPiece = (type: PieceType): PartKind => (SNAP_TYPES.includes(type) ? 'snap' : 'raceway');
export const isTurn = (type?: PieceType) => type === 'turn' || type === 'angled';
/** Straights open at one end only, the closed end rounded or angled off. */
export const isEndChannel = (type?: PieceType) => type === 'end_round' || type === 'end_angled';
/** Straights open along their sides as well as at the ends: both sides, or one. */
export const isOpenChannel = (type?: PieceType) => type === 'open' || type === 'open_side';
/** Straights, bridges, open and end channels: sized by length, orientation from their footprint. */
export const isLinear = (type?: PieceType) =>
  type === 'straight' || type === 'bridge' || isEndChannel(type) || isOpenChannel(type);
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
  type && !isSmallTurn(type, size) ? COUNTERPARTS[type] : undefined;

/** How far an end channel's closed corners are cut (angled) or rounded, in cells; big enough to read as closed. */
const END_CUT = 0.3;
const END_RADIUS = 0.35;

/** An end channel `n` cells long, open at its right end; its closed left end has rounded or angled corners. */
function endChannelPath(n: number, angled: boolean) {
  const [c, r] = [END_CUT, END_RADIUS];
  return angled
    ? `M${c} 0H${n}V1H${c}L0 ${1 - c}V${c}Z`
    : `M${r} 0H${n}V1H${r}A${r} ${r} 0 0 1 0 ${1 - r}V${r}A${r} ${r} 0 0 1 ${r} 0Z`;
}

/** Shape of a piece; turns are `size` × `size` cells, open and end channels `size` long, others a fixed size. */
export function pieceShape(type: PieceType, size = 2): PieceShape | undefined {
  if (isEndChannel(type) || isOpenChannel(type)) {
    const n = Math.max(1, size);
    const d = isEndChannel(type) ? endChannelPath(n, type === 'end_angled') : `M0 0H${n}V1H0Z`;
    return { label: PIECE_LABELS[type], w: n, h: 1, d };
  }
  if (!isTurn(type)) return PIECE_SHAPES[type];
  const n = clampTurnSize(size);
  const d = n === 1 ? 'M0 0H1V1H0Z' : type === 'turn' ? roundedTurnPath(n) : angledTurnPath(n);
  return { label: PIECE_LABELS[type], w: n, h: n, d };
}

export const isMirrored = (piece: { sub?: PieceType; flip?: boolean }) =>
  !!piece.flip && !!piece.sub && CHIRAL_PIECES.includes(piece.sub);

/** A 1×1 turn is a plain square, the same part in either style. */
export const isSmallTurn = (type: PieceType | undefined, size?: number) => isTurn(type) && size === 1;

/** The part a piece is printed as: a 1×1 turn is the same in either style. */
export const printedType = (type: PieceType, size: number): PieceType =>
  isSmallTurn(type, size) ? 'turn' : type;
const SMALL_TURN_LABEL = 'Channel, turn';

/** Label of a piece; `size` is a turn's size, so a 1×1 turn has no style. */
export function pieceLabel(
  type: PieceType,
  { mirrored = false, size }: { mirrored?: boolean; size?: number } = {},
) {
  if (isSmallTurn(type, size)) return SMALL_TURN_LABEL;
  const label = PIECE_LABELS[type];
  if (!mirrored) return label;
  return label.endsWith(')') ? label.slice(0, -1) + ', mirrored)' : label + ' (mirrored)';
}

/** A label shown under a "Channels" heading, without the repeated "Channel, " prefix: "Turn (rounded)". */
export const channelLabel = (label: string) =>
  label.replace(/^Channel, (.)/, (_, c: string) => c.toUpperCase());

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
