import type { PieceType } from '../../domain/types';

/** Custom object presets: name, columns, rows. */
export const DEVICE_PRESETS: [name: string, w: number, h: number][] = [
  ['Router', 2, 1],
  ['Switch', 2, 1],
  ['Power strip', 3, 1],
  ['NAS', 1, 2],
  ['Charger', 1, 1],
  ['UPS', 3, 2],
  ['PC', 2, 4],
  ['Monitor', 6, 4],
  ['Speaker', 2, 3],
  ['3D printer', 7, 7],
];

/** Turn sizes offered as buttons (angled turns start at 2). */
export const TURN_SIZES = [1, 2, 3, 4, 5];

interface CatalogEntry {
  sub: PieceType;
  flip?: boolean;
}

export interface ChannelGroup {
  title: string;
  kind: 'straight' | 'turns' | 'other';
  entries: CatalogEntry[];
}

const types = (...subs: PieceType[]): CatalogEntry[] => subs.map((sub) => ({ sub }));
/** Each chiral piece next to its mirror image. */
const withMirrors = (...subs: PieceType[]): CatalogEntry[] =>
  subs.flatMap((sub) => [{ sub }, { sub, flip: true }]);

export const CHANNEL_GROUPS: ChannelGroup[] = [
  { title: 'Straight', kind: 'straight', entries: types('straight', 'bridge') },
  { title: 'Turns', kind: 'turns', entries: types('turn', 'angled', 'cap') },
  { title: 'Merge and branch', kind: 'other', entries: withMirrors('y_round', 'y_angled') },
  { title: 'Junctions', kind: 'other', entries: types('t', 'cross1', 'cross', 'fork_round', 'fork_angled') },
  { title: 'Offsets', kind: 'other', entries: withMirrors('jog_round', 'jog_angled') },
];
