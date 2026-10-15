import { counterpart, isShaped, pieceLabel, SNAP_TYPES } from '../domain/pieces';
import type { EditorState } from '../store/store';

/** What is being placed and the keys that apply to it, or null when not placing. */
export function placingStatus(s: Pick<EditorState, 'tool' | 'block' | 'stamp'>) {
  if (s.tool !== 'place') return null;
  const { block, stamp } = s;
  const label = block
    ? `${block.name} ${block.h}×${block.w}`
    : stamp
      ? pieceLabel(stamp.sub, { size: stamp.len })
      : '';
  if (!label) return null;
  const hints = [
    'Click to place',
    'R rotate',
    stamp && isShaped(stamp.sub) && 'F flip',
    stamp && counterpart(stamp.sub, stamp.len) && 'T rounded/angled',
    stamp && SNAP_TYPES.includes(stamp.sub) && 'drag to paint',
    'Esc stop',
  ];
  return { label, hints: hints.filter(Boolean).join(' · ') };
}
