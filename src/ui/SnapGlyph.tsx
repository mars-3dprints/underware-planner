import { SNAP_SHAPES } from '../domain/pieces';
import type { PieceType } from '../domain/types';
import { ThreadRing } from './ThreadRing';

interface SnapGlyphProps {
  sub: PieceType;
  /** The snap's colour, and the colour of the lines that pick out its details. */
  fill: string;
  line: string;
  /** Outline around the snap, if any. */
  stroke?: string;
}

/** A snap seen from above, in a unit cell: its octagon, cut-outs, and any threaded hole or stub. */
export function SnapGlyph({ sub, fill, line, stroke }: SnapGlyphProps) {
  const shape = SNAP_SHAPES[sub];
  if (!shape) return null;
  return (
    <>
      <path
        d={shape.d}
        fill={fill}
        fillRule="evenodd"
        stroke={stroke}
        strokeWidth={1}
        vectorEffect="non-scaling-stroke"
      />
      {shape.thread && <ThreadRing r={shape.thread} stroke={fill} />}
      {shape.stub && (
        <>
          <circle cx={0.5} cy={0.5} r={shape.stub} fill={fill} stroke={line} strokeWidth={0.03} />
          <ThreadRing r={shape.stub} stroke={line} />
        </>
      )}
    </>
  );
}
