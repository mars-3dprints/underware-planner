/** A grid cell, or a point in cell units. One cell is one openGrid tile pitch (`CELL_MM`). */
export interface Cell {
  x: number;
  y: number;
}

/** Stored as `kind`: `plate` is an openGrid tile, `object` a custom device, `raceway` a channel. */
export type PartKind = 'plate' | 'object' | 'raceway' | 'snap';

/** Stored as `sub`: the type of a channel (raceway) or snap piece. */
export type PieceType =
  | 'straight'
  | 'bridge'
  | 'half_bridge'
  | 'turn'
  | 'angled'
  | 'y_round'
  | 'y_angled'
  | 'jog_round'
  | 'jog_angled'
  | 't'
  | 'cross'
  | 't_inline'
  | 'cross_inline'
  | 'open'
  | 'open_side'
  | 'end_round'
  | 'end_angled'
  | 't_end'
  | 'fork_round'
  | 'fork_angled'
  | 'cap'
  | 'channel_grip'
  | 'channel_base'
  | 'wall'
  | 'multiconnect'
  | 'base_compat';

/** Anything placed on the canvas. Positions and sizes are whole cells. */
export interface Part {
  id: string;
  kind: PartKind;
  name: string;
  x: number;
  y: number;
  /** Columns. */
  w: number;
  /** Rows. */
  h: number;
  color: string;
  /** Pieces only: the piece type. */
  sub?: PieceType;
  /** Pieces only: quarter turns clockwise (0-3). */
  rot?: number;
  /** Pieces only: mirrored. */
  flip?: boolean;
  /** Left out of the bill of materials (for example, parts already printed). Never set on custom objects. */
  noBom?: boolean;
}

/** A cable end: attached to a part (and follows it) or loose on a cell. */
export type Anchor = { objId: string; dx: number; dy: number } | { objId?: undefined; x: number; y: number };

export interface Cable {
  id: string;
  name: string;
  color: string;
  a: Anchor;
  b: Anchor;
  waypoints: Cell[];
  slackMm: number;
}

/** The layout: what is saved, exported and undone. */
export interface Doc {
  objects: Part[];
  cables: Cable[];
}

/** A tile or custom object being placed. `swapped`: w and h are rotated relative to the panel fields. */
export interface Block {
  kind: 'plate' | 'object';
  name: string;
  w: number;
  h: number;
  color: string;
  swapped?: boolean;
}

/** A piece being placed. `len` is the length of straights and the size of turns. */
export interface Stamp {
  sub: PieceType;
  len: number;
  rot: number;
  flip: boolean;
  color: string;
}

export type Tool = 'select' | 'pan' | 'cable' | 'place';

/** An axis-aligned rectangle in cells. */
export interface Bounds {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Screen = world * k + (x, y); one world unit is one cell. */
export interface View {
  x: number;
  y: number;
  k: number;
}

export type Selection = { type: 'obj' | 'cable'; id: string } | null;
