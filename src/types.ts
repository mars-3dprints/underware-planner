export const CELL_MM = 28; // openGrid tile pitch
export interface Cell { x: number; y: number }
export type Kind = 'plate' | 'object' | 'raceway' | 'cover';
export type Sub = 'straight' | 'bridge' | 'turn' | 'angled' | 'y_round' | 'y_angled'
  | 'jog_round' | 'jog_angled' | 't' | 'cross' | 'cross1' | 'fork_round' | 'fork_angled' | 'cap' | 'hole' | 'wall';
export interface Obj {
  id: string; kind: Kind; name: string;
  x: number; y: number; w: number; h: number; // w = columns, h = rows (in cells)
  color: string;
  sub?: Sub; rot?: number; flip?: boolean; // add-ons: type, quarter turns (0-3) and mirror for fixed-shape raceway pieces
}
/** Either attached to an object (follows it) or a free cell (cable simply stops there). */
export type Anchor = { objId: string; dx: number; dy: number } | { objId?: undefined; x: number; y: number };
export interface Cable {
  id: string; name: string; color: string;
  a: Anchor; b: Anchor; waypoints: Cell[]; slackMm: number;
}
export interface Doc { objects: Obj[]; cables: Cable[] }
export interface Block { kind: 'plate' | 'object'; name: string; w: number; h: number; color: string; swapped?: boolean } // tile / custom object being placed (swapped: w/h are rotated relative to the panel fields)
export type Tool = 'select' | 'pan' | 'cable' | 'place';
export interface View { x: number; y: number; k: number } // screen = world*k + (x,y); world unit = 1 cell
export type Sel = { type: 'obj' | 'cable'; id: string } | null;

export const COLORS = ['#e76f51', '#f4a261', '#2a9d8f', '#4cc9f0', '#4361ee', '#9d4edd', '#343a40'];
export const PLATE_DEFAULT = '#b8c4bd';

export interface Stamp { sub: Sub; len: number; rot: number; flip: boolean; color: string }
export const kindOf = (s: Sub): Kind => (s === 'hole' || s === 'wall' ? 'cover' : 'raceway');

// ---- channel catalogue. Channel width is one cell (28 mm); shapes are drawn in cell units, unrotated. ----
export interface Piece { label: string; w: number; h: number; d: string; sep?: string } // sep = divider line between merged channels
export const turnPath = (n: number) => `M0 0H1A${n - 1} ${n - 1} 0 0 1 ${n} ${n - 1}V${n}H${n - 1}V${n - 1}${n > 2 ? `A${n - 2} ${n - 2} 0 0 0 1 1` : ''}H0Z`;
export const PIECES: Partial<Record<Sub, Piece>> = {
  y_round: { label: 'Channel, merge/branch (rounded)', w: 2, h: 3, d: 'M0 0H2V3H1V2A1 1 0 0 1 0 1Z', sep: 'M1 0V1' },
  y_angled: { label: 'Channel, merge/branch (angled)', w: 2, h: 3, d: 'M0 0H2V3H1V2L0 1Z', sep: 'M1 0V1' },
  jog_round: { label: 'Channel, offset (rounded)', w: 2, h: 3, d: 'M0 0V1A1 1 0 0 0 1 2V3H2V2A1 1 0 0 0 1 1V0Z' },
  jog_angled: { label: 'Channel, offset (angled)', w: 2, h: 3, d: 'M0 0V1.208L1 2.208V3H2V1.792L1 .792V0Z' },
  t: { label: 'Channel, 3-way junction', w: 2, h: 3, d: 'M0 0H1V1H2V2H1V3H0Z' },
  cross1: { label: 'Channel, 4-way junction (1×1)', w: 1, h: 1, d: 'M0 0H1V1H0Z' },
  cross: { label: 'Channel, 4-way junction', w: 3, h: 3, d: 'M1 0H2V1H3V2H2V3H1V2H0V1H1Z' },
  fork_round: { label: 'Channel, fork (rounded)', w: 3, h: 3, d: 'M0 0H1A1 1 0 0 1 2 1H3V2H2A1 1 0 0 1 1 3H0V2H1V1H0Z' },
  fork_angled: { label: 'Channel, fork (angled)', w: 3, h: 3, d: 'M0 0H1L2 1H3V2H2L1 3H0V2H1V1H0Z' },
  cap: { label: 'Channel, short turn', w: 2, h: 1, d: 'M0 0H1A1 1 0 0 1 2 1H0Z' },
};
export const angledPath = (n: number) => `M0 0H1L${n} ${n - 1}V${n}H${n - 1}V${n - 1}L1 1H0Z`;
/** Rounded <-> angled counterpart of a channel (same size and openings), or undefined if the part has none. */
const COUNTERPART: Partial<Record<Sub, Sub>> = { turn: 'angled', angled: 'turn', y_round: 'y_angled', y_angled: 'y_round', jog_round: 'jog_angled', jog_angled: 'jog_round', fork_round: 'fork_angled', fork_angled: 'fork_round' };
export const counterpart = (sub?: Sub, size = 2): Sub | undefined => (sub && !(sub === 'turn' && size < 2) ? COUNTERPART[sub] : undefined);
export const MAX_TURN = 12;
export const isTurn = (s?: Sub) => s === 'turn' || s === 'angled';
export const isShaped = (s?: Sub) => s === 'turn' || s === 'angled' || (!!s && !!PIECES[s]);
/** Shape for a sub type; `turn` is a rounded turn of n x n cells, every other piece has a fixed size. */
export function pieceOf(sub: Sub, n = 2): Piece | undefined {
  if (isTurn(sub)) {
    const k = Math.max(1, Math.min(MAX_TURN, n));
    return { label: sub === 'turn' ? 'Channel, turn (rounded)' : 'Channel, turn (angled)', w: k, h: k, d: k === 1 ? 'M0 0H1V1H0Z' : sub === 'turn' ? turnPath(k) : angledPath(k) };
  }
  return PIECES[sub];
}
export const RACEWAY_SUBS: Sub[] = ['straight', 'bridge', 'turn', 'angled', 'y_round', 'y_angled',
  'jog_round', 'jog_angled', 't', 'cross1', 'cross', 'fork_round', 'fork_angled', 'cap'];
export const ADDON_LABEL: Record<Sub, string> = {
  straight: 'Channel, straight', bridge: 'Channel, bridge', turn: 'Channel, turn (rounded)', angled: 'Channel, turn (angled)', hole: 'Tile cover', wall: 'Wall mount',
  ...(Object.fromEntries(Object.entries(PIECES).map(([k, p]) => [k, p!.label])) as Record<string, string>),
} as Record<Sub, string>;
export const ADDON_ORDER: Sub[] = [...RACEWAY_SUBS, 'hole', 'wall'];
/** Pieces whose mirror image is a different part to print (rotating never changes this, flipping does). */
export const CHIRAL: Sub[] = ['y_round', 'y_angled', 'jog_round', 'jog_angled'];
export const isMirrored = (o: { sub?: Sub; flip?: boolean }) => !!o.flip && !!o.sub && CHIRAL.includes(o.sub);
export const labelOf = (sub: Sub, mirrored = false) => {
  const l = ADDON_LABEL[sub]; if (!mirrored) return l;
  return l.endsWith(')') ? l.slice(0, -1) + ', mirrored)' : l + ' (mirrored)';
};
export const ADDON_DEFAULT = '#343a40';

/** Footprint (cells) of an add-on for a given length / quarter-turn count. */
export function stampDims(s: { sub: Sub; len: number; rot: number }) {
  if (s.sub === 'straight' || s.sub === 'bridge') {
    const l = s.sub === 'bridge' ? Math.max(3, s.len) : Math.max(1, s.len);
    return s.rot % 2 === 0 ? { w: l, h: 1 } : { w: 1, h: l };
  }
  if (isTurn(s.sub)) { const k = Math.max(1, Math.min(MAX_TURN, s.len)); return { w: k, h: k }; }
  const p = PIECES[s.sub];
  if (!p) return { w: 1, h: 1 };
  return s.rot % 2 === 0 ? { w: p.w, h: p.h } : { w: p.h, h: p.w };
}

/** Openings of a channel (cell units, shape's own frame): position on the edge and outward direction. */
export type Port = [x: number, y: number, dx: number, dy: number];
export function portsOf(sub: Sub, n: number): Port[] {
  if (isTurn(sub)) return [[0, 0.5, -1, 0], [n - 0.5, n, 0, 1]];
  switch (sub) {
    case 'y_round': case 'y_angled': return [[0.5, 0, 0, -1], [1.5, 0, 0, -1], [1.5, 3, 0, 1]];
    case 'jog_round': case 'jog_angled': return [[0.5, 0, 0, -1], [1.5, 3, 0, 1]];
    case 't': return [[0.5, 0, 0, -1], [0.5, 3, 0, 1], [2, 1.5, 1, 0]];
    case 'cross1': return [[0.5, 0, 0, -1], [1, 0.5, 1, 0], [0.5, 1, 0, 1], [0, 0.5, -1, 0]];
    case 'cross': return [[1.5, 0, 0, -1], [3, 1.5, 1, 0], [1.5, 3, 0, 1], [0, 1.5, -1, 0]];
    case 'fork_round': case 'fork_angled': return [[0, 0.5, -1, 0], [0, 2.5, -1, 0], [3, 1.5, 1, 0]];
    case 'cap': return [[0, 0.5, -1, 0], [1.5, 1, 0, 1]];
    default: return [];
  }
}
/** Small rectangles just inside each opening (used to keep the ends of an inset channel flush). */
export const restoreD = (ports: Port[], depth: number, half: number) => ports.map(([x, y, dx, dy]) => {
  const f = (a: number, b: number) => `${+(x - dx * a - dy * b).toFixed(3)} ${+(y - dy * a + dx * b).toFixed(3)}`;
  return `M${f(-0.02, -half)}L${f(depth, -half)}L${f(depth, half)}L${f(-0.02, half)}Z`;
}).join('');
/** Arrow markers (path data) pointing out of each opening. */
export const arrowsD = (ports: Port[]) => ports.map(([x, y, dx, dy]) => {
  const f = (a: number, b: number) => `${+(x - dx * a - dy * b).toFixed(3)} ${+(y - dy * a + dx * b).toFixed(3)}`;
  return `M${f(0.08, 0)}L${f(0.3, 0.14)}L${f(0.3, -0.14)}Z`;
}).join('');

/** Orientation of a straight channel: from its shape, or (when 1×1) from the quarter-turn parity of `rot`. */
export const isVert = (o: { w: number; h: number; rot?: number }) => (o.w === o.h ? (o.rot ?? 0) % 2 === 1 : o.h > o.w);
/** Patch that sets a straight channel's length, keeping its orientation (and the parity of `rot` in step with it). */
export const lenPatch = (o: { w: number; h: number; rot?: number }, n: number) => {
  const v = isVert(o);
  return { w: v ? 1 : n, h: v ? n : 1, rot: ((o.rot ?? 0) % 2 === (v ? 1 : 0) ? (o.rot ?? 0) : (o.rot ?? 0) + 1) % 4 };
};

/** View layers that can be shown or hidden. Tile covers and wall mounts belong to `tiles`. */
export type Layer = 'tiles' | 'objects' | 'channels' | 'cables';
export const LAYERS: { id: Layer; label: string }[] = [{ id: 'tiles', label: 'Tiles' }, { id: 'objects', label: 'Objects' }, { id: 'channels', label: 'Channels' }, { id: 'cables', label: 'Cables' }];
export const layerOf = (o: { kind: string }): Layer => (o.kind === 'object' ? 'objects' : o.kind === 'raceway' ? 'channels' : 'tiles');
