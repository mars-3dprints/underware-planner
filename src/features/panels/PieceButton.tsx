import { isTurn, pieceLabel } from '../../domain/pieces';
import type { PieceType } from '../../domain/types';
import { PieceThumb } from '../../ui/PieceThumb';

interface PieceButtonProps {
  sub: PieceType;
  len?: number;
  flip?: boolean;
  active: boolean;
  onClick: () => void;
}

/** Catalogue button showing a piece's thumbnail. */
export function PieceButton({ sub, len, flip, active, onClick }: PieceButtonProps) {
  const label = isTurn(sub)
    ? `${pieceLabel(sub, { size: len })} ${len}×${len}`
    : pieceLabel(sub, { mirrored: flip });
  return (
    <button className={'tile' + (active ? ' on' : '')} onClick={onClick} title={label} aria-label={label}>
      <PieceThumb sub={sub} len={len} flip={flip} />
    </button>
  );
}
