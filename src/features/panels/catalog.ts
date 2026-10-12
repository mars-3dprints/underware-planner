import { CHANNEL_FAMILIES, isMirrored } from '../../domain/pieces';
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

/** Library entries, with each chiral piece next to its mirror image. */
const types = (...subs: PieceType[]): CatalogEntry[] =>
  subs.flatMap((sub) => (isMirrored({ sub, flip: true }) ? [{ sub }, { sub, flip: true }] : [{ sub }]));

/** Groups with their own controls: a length field for straights, size buttons for turns. */
const KINDS: Partial<Record<string, ChannelGroup['kind']>> = { Straight: 'straight', Turns: 'turns' };

export const CHANNEL_GROUPS: ChannelGroup[] = CHANNEL_FAMILIES.map(({ title, types: subs }) => ({
  title,
  kind: KINDS[title] ?? 'other',
  entries: types(...subs),
}));
