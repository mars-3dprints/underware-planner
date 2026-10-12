import { TILE_LABEL } from './constants';
import { isBomPart, isDoc } from './doc';
import { isTurn, PIECE_LABELS, PIECE_SHAPES, stampSize } from './pieces';
import type { Doc, Part, PieceType } from './types';

/** Piece types from older saves, renamed or merged since. */
type LegacyType = 'turn2' | 'turn3' | 'branch_round' | 'branch_angled' | 'jog_round_s' | 'jog_angled_s';

function migratePart(part: Part): Part {
  const sub = part.sub as PieceType | LegacyType | undefined;
  if (part.kind === 'plate') return part.name === 'Plate' ? { ...part, name: TILE_LABEL } : part;
  if (part.kind === 'cover') return part.name === 'Hole cover' ? { ...part, name: PIECE_LABELS.hole } : part;
  // Custom objects were briefly part of the bill of materials, and could be left out of it.
  if (!isBomPart(part) && part.noBom) {
    const { noBom: _, ...rest } = part;
    return rest;
  }
  if (part.kind !== 'raceway' || !sub) return part;

  // Earlier fixed-size turns.
  if (sub === 'turn2' || sub === 'turn3') {
    const n = sub === 'turn2' ? 3 : 4;
    return { ...part, sub: 'turn', w: n, h: n, name: PIECE_LABELS.turn };
  }
  // A branch is a merge turned half way round.
  if (sub === 'branch_round' || sub === 'branch_angled') {
    const type = sub === 'branch_round' ? 'y_round' : 'y_angled';
    const defaultName = part.name === 'Channel, branch (rounded)' || part.name === 'Channel, branch (angled)';
    return {
      ...part,
      sub: type,
      rot: ((part.rot ?? 0) + 2) % 4,
      name: defaultName ? PIECE_LABELS[type] : part.name,
    };
  }
  // The tight offsets were just the mirrored parts.
  if (sub === 'jog_round_s' || sub === 'jog_angled_s') {
    const type = sub === 'jog_round_s' ? 'jog_round' : 'jog_angled';
    return { ...part, sub: type, flip: !part.flip, name: PIECE_LABELS[type] };
  }
  if (isTurn(sub)) {
    const n = Math.max(part.w, part.h);
    return part.w === n && part.h === n ? part : { ...part, w: n, h: n };
  }
  // Older saves stored 1×1 junction pieces: resize them to the catalogue footprint.
  if (!PIECE_SHAPES[sub]) return part;
  const { w, h } = stampSize({ sub, len: 1, rot: part.rot ?? 0 });
  return part.w === w && part.h === h ? part : { ...part, w, h, name: PIECE_LABELS[sub] };
}

/** Brings a layout from an older save up to date. */
export const migrateDoc = (doc: Doc): Doc => ({ ...doc, objects: doc.objects.map(migratePart) });

/** A layout read from a save or an exported file, brought up to date, or null when it is not a layout. */
export const readLayout = (value: unknown): Doc | null => (isDoc(value) ? migrateDoc(value) : null);
