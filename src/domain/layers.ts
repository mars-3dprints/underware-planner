import type { PartKind } from './types';

/** View layers that can be shown or hidden. Tile covers and wall mounts belong to `tiles`. */
export type Layer = 'tiles' | 'objects' | 'channels' | 'cables';

export const LAYERS: { id: Layer; label: string }[] = [
  { id: 'tiles', label: 'Tiles' },
  { id: 'objects', label: 'Objects' },
  { id: 'channels', label: 'Channels' },
  { id: 'cables', label: 'Cables' },
];

export const layerOf = (part: { kind: PartKind }): Layer =>
  part.kind === 'object' ? 'objects' : part.kind === 'raceway' ? 'channels' : 'tiles';
