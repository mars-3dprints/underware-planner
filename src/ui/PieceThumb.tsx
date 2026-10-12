import { useId } from 'react';
import { isLinear, minLength, pieceShape, SNAP_TYPES } from '../domain/pieces';
import { piecePorts } from '../domain/ports';
import { InsetMask } from './InsetMask';
import { SnapGlyph } from './SnapGlyph';
import type { PieceType } from '../domain/types';

const PAD = 0.15;
/**
 * Shaped pieces are drawn narrower on each side with their openings flush, like the canvas, so openings in a
 * straight run show. Deeper than the canvas inset so it reads at thumbnail size. Straights and bridges stay plain bars.
 */
const INSET = 0.1;

interface PieceThumbProps {
  sub: PieceType;
  len?: number;
  size?: number;
  flip?: boolean;
}

/** Small picture of a piece, drawn from the same shapes the canvas uses. */
export function PieceThumb({ sub, len = 3, size = 34, flip = false }: PieceThumbProps) {
  const maskId = useId();
  if (SNAP_TYPES.includes(sub)) {
    return (
      <svg width={size} height={size} viewBox="0 0 1 1" aria-hidden="true">
        <SnapGlyph sub={sub} fill="currentColor" line="var(--panel)" />
      </svg>
    );
  }
  const linear = isLinear(sub);
  const shape = pieceShape(sub, len);
  const w = shape?.w ?? (linear ? Math.max(len, minLength(sub)) : 1);
  const h = shape?.h ?? 1;
  const d = shape?.d ?? `M0 0H${w}V1H0Z`;
  // Straights and bridges are plain bars; everything else shows its openings, as on the canvas.
  const ports = shape ? piecePorts(sub, shape.w) : [];
  return (
    <svg
      width={size}
      height={size}
      viewBox={`${-PAD} ${-PAD} ${w + PAD * 2} ${h + PAD * 2}`}
      aria-hidden="true"
    >
      <g transform={flip ? `translate(${w} 0) scale(-1 1)` : undefined}>
        {ports.length > 0 ? (
          <>
            <InsetMask id={maskId} d={d} ports={ports} inset={INSET} x={0} y={0} w={w} h={h} />
            <path d={d} fill="currentColor" mask={`url(#${maskId})`} />
          </>
        ) : (
          <path d={d} fill="currentColor" stroke="currentColor" strokeWidth={0.06} strokeLinejoin="round" />
        )}
        {shape?.sep && (
          <path d={shape.sep} fill="none" stroke="var(--panel)" strokeWidth={0.07} strokeLinecap="round" />
        )}
        {sub === 'bridge' && (
          <rect x={1} y={0.12} width={w - 2} height={0.76} fill="var(--panel)" opacity={0.45} />
        )}
      </g>
    </svg>
  );
}
