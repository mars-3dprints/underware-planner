import { useId } from 'react';
import { isLinear, minLength, pieceShape, TILE_HOLE_PATH } from '../domain/pieces';
import { piecePorts } from '../domain/ports';
import { InsetMask } from './InsetMask';
import type { PieceType } from '../domain/types';

const PAD = 0.15;
/**
 * Shaped pieces are drawn narrower on each side with their openings flush, like the canvas, so openings in a
 * straight run show. Deeper than the canvas inset so it reads at thumbnail size. Straights and bridges stay plain bars.
 */
const INSET = 0.1;
const WALL_MOUNT_PATH = `${TILE_HOLE_PATH}M.4 .5a.1 .1 0 1 0 .2 0a.1 .1 0 1 0 -.2 0Z`;

interface PieceThumbProps {
  sub: PieceType;
  len?: number;
  size?: number;
  flip?: boolean;
}

/** Small picture of a piece, drawn from the same shapes the canvas uses. */
export function PieceThumb({ sub, len = 3, size = 34, flip = false }: PieceThumbProps) {
  const maskId = useId();
  if (sub === 'hole' || sub === 'wall') {
    return (
      <svg width={size} height={size} viewBox="0 0 1 1" aria-hidden="true">
        <path
          d={sub === 'wall' ? WALL_MOUNT_PATH : TILE_HOLE_PATH}
          transform="translate(.5 .5) scale(1.3) translate(-.5 -.5)"
          fill="currentColor"
          fillRule="evenodd"
        />
      </svg>
    );
  }
  const linear = isLinear(sub);
  const shape = pieceShape(sub, len);
  const w = linear ? Math.max(len, minLength(sub)) : (shape?.w ?? 1);
  const h = linear ? 1 : (shape?.h ?? 1);
  const d = linear ? `M0 0H${w}V1H0Z` : (shape?.d ?? '');
  const ports = !linear && shape ? piecePorts(sub, shape.w) : [];
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
